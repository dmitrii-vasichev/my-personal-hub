from __future__ import annotations

from typing import Optional

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.note import Note
from app.models.job import Job
from app.models.note_job_link import NoteJobLink
from app.models.user import User


async def _get_note(db: AsyncSession, note_id: int, user: User) -> Optional[Note]:
    result = await db.execute(
        select(Note).where(Note.id == note_id, Note.user_id == user.id)
    )
    return result.scalar_one_or_none()


async def _get_job(db: AsyncSession, job_id: int, user: User) -> Optional[Job]:
    result = await db.execute(
        select(Job).where(Job.id == job_id, Job.user_id == user.id)
    )
    return result.scalar_one_or_none()


async def link_note_job(
    db: AsyncSession, note_id: int, job_id: int, user: User
) -> bool:
    """Link a note to a job. Returns False if note or job not found."""
    note = await _get_note(db, note_id, user)
    if note is None:
        return False
    job = await _get_job(db, job_id, user)
    if job is None:
        return False

    existing = await db.execute(
        select(NoteJobLink).where(
            NoteJobLink.note_id == note_id, NoteJobLink.job_id == job_id
        )
    )
    if existing.scalar_one_or_none():
        return True

    db.add(NoteJobLink(note_id=note_id, job_id=job_id))
    await db.commit()
    return True


async def unlink_note_job(
    db: AsyncSession, note_id: int, job_id: int, user: User
) -> bool:
    """Unlink a note from a job. Returns False if note not found."""
    note = await _get_note(db, note_id, user)
    if note is None:
        return False

    await db.execute(
        delete(NoteJobLink).where(
            NoteJobLink.note_id == note_id, NoteJobLink.job_id == job_id
        )
    )
    await db.commit()
    return True


async def get_note_linked_jobs(
    db: AsyncSession, note_id: int, user: User
) -> Optional[list[Job]]:
    """Return jobs linked to a note, or None if note not found."""
    note = await _get_note(db, note_id, user)
    if note is None:
        return None

    result = await db.execute(
        select(Job)
        .join(NoteJobLink, NoteJobLink.job_id == Job.id)
        .where(NoteJobLink.note_id == note_id)
        .order_by(Job.title)
    )
    return list(result.scalars().all())


async def get_job_linked_notes(
    db: AsyncSession, job_id: int, user: User
) -> Optional[list[Note]]:
    """Return notes linked to a job, or None if job not found."""
    job = await _get_job(db, job_id, user)
    if job is None:
        return None

    result = await db.execute(
        select(Note)
        .join(NoteJobLink, NoteJobLink.note_id == Note.id)
        .where(NoteJobLink.job_id == job_id)
        .order_by(Note.title)
    )
    return list(result.scalars().all())
