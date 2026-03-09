from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.models.calendar import CalendarEvent, EventNote
from app.models.task import Visibility
from app.models.user import User, UserRole
from app.schemas.calendar import (
    CalendarEventCreate,
    CalendarEventUpdate,
    EventNoteCreate,
    EventNoteUpdate,
)
from app.services.task import PermissionDeniedError


# ── Helpers ───────────────────────────────────────────────────────────────────


def _can_access_event(event: CalendarEvent, user: User) -> bool:
    """Check if user can read this event."""
    if user.role == UserRole.admin:
        return True
    return event.user_id == user.id or event.visibility == Visibility.family


def _can_edit_event(event: CalendarEvent, user: User) -> bool:
    """Check if user can edit/delete this event."""
    if user.role == UserRole.admin:
        return True
    return event.user_id == user.id


def _events_base_query(user: User):
    q = select(CalendarEvent).options(
        selectinload(CalendarEvent.notes),
        joinedload(CalendarEvent.owner),
    )
    if user.role != UserRole.admin:
        q = q.where(
            or_(
                CalendarEvent.user_id == user.id,
                CalendarEvent.visibility == Visibility.family,
            )
        )
    return q


# ── Calendar Events ───────────────────────────────────────────────────────────


async def list_events(
    db: AsyncSession,
    user: User,
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
) -> list[CalendarEvent]:
    q = _events_base_query(user)
    if start:
        q = q.where(CalendarEvent.end_time >= start)
    if end:
        q = q.where(CalendarEvent.start_time <= end)
    q = q.order_by(CalendarEvent.start_time.asc())
    result = await db.execute(q)
    return list(result.unique().scalars().all())


async def get_event(
    db: AsyncSession,
    event_id: int,
    user: User,
) -> CalendarEvent | None:
    result = await db.execute(
        select(CalendarEvent)
        .where(CalendarEvent.id == event_id)
        .options(selectinload(CalendarEvent.notes), joinedload(CalendarEvent.owner))
    )
    event = result.unique().scalar_one_or_none()
    if event is None or not _can_access_event(event, user):
        return None
    return event


async def create_event(
    db: AsyncSession,
    data: CalendarEventCreate,
    user: User,
) -> CalendarEvent:
    event = CalendarEvent(
        user_id=user.id,
        title=data.title,
        description=data.description,
        start_time=data.start_time,
        end_time=data.end_time,
        location=data.location,
        all_day=data.all_day,
        visibility=data.visibility,
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)
    return event


async def update_event(
    db: AsyncSession,
    event_id: int,
    data: CalendarEventUpdate,
    user: User,
) -> CalendarEvent | None:
    result = await db.execute(
        select(CalendarEvent)
        .where(CalendarEvent.id == event_id)
        .options(selectinload(CalendarEvent.notes), joinedload(CalendarEvent.owner))
    )
    event = result.unique().scalar_one_or_none()
    if event is None or not _can_access_event(event, user):
        return None
    if not _can_edit_event(event, user):
        raise PermissionDeniedError("You can only edit your own events")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(event, field, value)

    await db.commit()
    await db.refresh(event)
    return event


async def delete_event(
    db: AsyncSession,
    event_id: int,
    user: User,
) -> bool:
    result = await db.execute(
        select(CalendarEvent).where(CalendarEvent.id == event_id)
    )
    event = result.scalar_one_or_none()
    if event is None or not _can_access_event(event, user):
        return False
    if not _can_edit_event(event, user):
        raise PermissionDeniedError("You can only delete your own events")
    await db.delete(event)
    await db.commit()
    return True


# ── Event Notes ───────────────────────────────────────────────────────────────


async def list_notes(
    db: AsyncSession,
    event_id: int,
    user: User,
) -> list[EventNote] | None:
    # Verify access to the event
    event = await get_event(db, event_id, user)
    if event is None:
        return None
    result = await db.execute(
        select(EventNote)
        .where(EventNote.event_id == event_id)
        .order_by(EventNote.created_at.asc())
    )
    return list(result.scalars().all())


async def create_note(
    db: AsyncSession,
    event_id: int,
    data: EventNoteCreate,
    user: User,
) -> EventNote | None:
    event = await get_event(db, event_id, user)
    if event is None:
        return None
    note = EventNote(event_id=event_id, user_id=user.id, content=data.content)
    db.add(note)
    await db.commit()
    await db.refresh(note)
    return note


async def update_note(
    db: AsyncSession,
    note_id: int,
    data: EventNoteUpdate,
    user: User,
) -> EventNote | None:
    result = await db.execute(select(EventNote).where(EventNote.id == note_id))
    note = result.scalar_one_or_none()
    if note is None:
        return None
    # Only the author can edit their note (admin can edit any)
    if user.role != UserRole.admin and note.user_id != user.id:
        return None
    note.content = data.content
    await db.commit()
    await db.refresh(note)
    return note


async def delete_note(
    db: AsyncSession,
    note_id: int,
    user: User,
) -> bool:
    result = await db.execute(select(EventNote).where(EventNote.id == note_id))
    note = result.scalar_one_or_none()
    if note is None:
        return False
    if user.role != UserRole.admin and note.user_id != user.id:
        return False
    await db.delete(note)
    await db.commit()
    return True


# ── Notes count helper for response enrichment ────────────────────────────────


async def get_notes_count(db: AsyncSession, event_id: int) -> int:
    result = await db.execute(
        select(func.count()).where(EventNote.event_id == event_id)
    )
    return result.scalar_one()
