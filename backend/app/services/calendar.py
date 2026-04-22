from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.models.calendar import CalendarEvent, EventNote
from app.models.job import ApplicationStatus, Job
from app.models.task import Visibility
from app.models.user import User, UserRole
from app.schemas.calendar import (
    CalendarEventCreate,
    CalendarEventUpdate,
    EventNoteCreate,
    EventNoteUpdate,
    JobBrief,
    JobHintResponse,
)
from app.services.task import PermissionDeniedError


TERMINAL_JOB_STATUSES = frozenset({
    ApplicationStatus.accepted,
    ApplicationStatus.rejected,
    ApplicationStatus.ghosted,
    ApplicationStatus.withdrawn,
})


# ── Helpers ───────────────────────────────────────────────────────────────────


def _exclude_demo_owners(owner_id_col):
    """Exclude records owned by demo users."""
    demo_ids = select(User.id).where(User.role == UserRole.demo)
    return ~owner_id_col.in_(demo_ids)


def _can_access_event(event: CalendarEvent, user: User) -> bool:
    """Check if user can read this event."""
    if user.role == UserRole.demo:
        return event.user_id == user.id
    # Non-demo users never see demo user's data
    if event.owner and event.owner.role == UserRole.demo:
        return False
    if user.role == UserRole.admin:
        return True
    if event.user_id == user.id:
        return True
    return event.visibility == Visibility.family


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
    if user.role == UserRole.demo:
        q = q.where(CalendarEvent.user_id == user.id)
    elif user.role == UserRole.admin:
        q = q.where(_exclude_demo_owners(CalendarEvent.user_id))
    else:
        q = q.where(
            or_(
                CalendarEvent.user_id == user.id,
                and_(
                    CalendarEvent.visibility == Visibility.family,
                    _exclude_demo_owners(CalendarEvent.user_id),
                ),
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

    data_dict = data.model_dump(exclude_unset=True)
    if "job_id" in data_dict and data_dict["job_id"] is not None:
        job_check = await db.execute(
            select(Job.id).where(
                Job.id == data_dict["job_id"],
                Job.user_id == user.id,
            )
        )
        if job_check.scalar_one_or_none() is None:
            raise HTTPException(status_code=404, detail="Job not found")

    for field, value in data_dict.items():
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


# ── Job-hint (D13) ────────────────────────────────────────────────────────────


async def _find_hint_candidates(
    db: AsyncSession, event: CalendarEvent, user: User
) -> list[Job]:
    """Return non-terminal jobs whose ``company`` (case-insensitive,
    trimmed) appears as a substring of ``event.title``. Pure read —
    scoped to ``user.id`` so cross-user jobs can never leak.
    """
    title_lc = (event.title or "").lower().strip()
    if not title_lc:
        return []
    result = await db.execute(
        select(Job).where(
            Job.user_id == user.id,
            or_(
                Job.status.is_(None),
                Job.status.notin_(TERMINAL_JOB_STATUSES),
            ),
        )
    )
    jobs = list(result.scalars().all())
    return [
        j
        for j in jobs
        if j.company
        and j.company.lower().strip()
        and j.company.lower().strip() in title_lc
    ]


async def suggest_job_for_event(
    db: AsyncSession, event_id: int, user: User
) -> JobHintResponse:
    """Return the single-candidate hint for ``event_id``. 404 if the
    event doesn't exist or isn't owned by ``user``. Returns a
    null-filled response when there are zero or ≥2 candidates —
    callers that need to distinguish the two should use
    ``_find_hint_candidates`` directly (the backfill script does this).
    """
    result = await db.execute(
        select(CalendarEvent).where(
            CalendarEvent.id == event_id,
            CalendarEvent.user_id == user.id,
        )
    )
    event = result.scalar_one_or_none()
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    candidates = await _find_hint_candidates(db, event, user)
    if len(candidates) == 1:
        j = candidates[0]
        return JobHintResponse(
            suggested_job_id=j.id,
            match_reason="substring",
            job=JobBrief(
                id=j.id, title=j.title, company=j.company, status=j.status
            ),
        )
    return JobHintResponse(
        suggested_job_id=None, match_reason=None, job=None
    )


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
