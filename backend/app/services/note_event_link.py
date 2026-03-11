from __future__ import annotations

from typing import Optional

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.note import Note
from app.models.calendar import CalendarEvent
from app.models.note_event_link import NoteEventLink
from app.models.user import User


async def _get_note(db: AsyncSession, note_id: int, user: User) -> Optional[Note]:
    result = await db.execute(
        select(Note).where(Note.id == note_id, Note.user_id == user.id)
    )
    return result.scalar_one_or_none()


async def _get_event(
    db: AsyncSession, event_id: int, user: User
) -> Optional[CalendarEvent]:
    result = await db.execute(
        select(CalendarEvent).where(
            CalendarEvent.id == event_id, CalendarEvent.user_id == user.id
        )
    )
    return result.scalar_one_or_none()


async def link_note_event(
    db: AsyncSession, note_id: int, event_id: int, user: User
) -> bool:
    """Link a note to a calendar event. Returns False if note or event not found."""
    note = await _get_note(db, note_id, user)
    if note is None:
        return False
    event = await _get_event(db, event_id, user)
    if event is None:
        return False

    existing = await db.execute(
        select(NoteEventLink).where(
            NoteEventLink.note_id == note_id, NoteEventLink.event_id == event_id
        )
    )
    if existing.scalar_one_or_none():
        return True

    db.add(NoteEventLink(note_id=note_id, event_id=event_id))
    await db.commit()
    return True


async def unlink_note_event(
    db: AsyncSession, note_id: int, event_id: int, user: User
) -> bool:
    """Unlink a note from a calendar event. Returns False if note not found."""
    note = await _get_note(db, note_id, user)
    if note is None:
        return False

    await db.execute(
        delete(NoteEventLink).where(
            NoteEventLink.note_id == note_id, NoteEventLink.event_id == event_id
        )
    )
    await db.commit()
    return True


async def get_note_linked_events(
    db: AsyncSession, note_id: int, user: User
) -> Optional[list[CalendarEvent]]:
    """Return calendar events linked to a note, or None if note not found."""
    note = await _get_note(db, note_id, user)
    if note is None:
        return None

    result = await db.execute(
        select(CalendarEvent)
        .join(NoteEventLink, NoteEventLink.event_id == CalendarEvent.id)
        .where(NoteEventLink.note_id == note_id)
        .order_by(CalendarEvent.start_time)
    )
    return list(result.scalars().all())


async def get_event_linked_notes(
    db: AsyncSession, event_id: int, user: User
) -> Optional[list[Note]]:
    """Return notes linked to a calendar event, or None if event not found."""
    event = await _get_event(db, event_id, user)
    if event is None:
        return None

    result = await db.execute(
        select(Note)
        .join(NoteEventLink, NoteEventLink.note_id == Note.id)
        .where(NoteEventLink.event_id == event_id)
        .order_by(Note.title)
    )
    return list(result.scalars().all())
