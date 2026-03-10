from __future__ import annotations

from typing import Optional

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.job import Job
from app.models.calendar import CalendarEvent
from app.models.job_event_link import JobEventLink
from app.models.user import User


async def _get_job(db: AsyncSession, job_id: int, user: User) -> Optional[Job]:
    result = await db.execute(
        select(Job).where(Job.id == job_id, Job.user_id == user.id)
    )
    return result.scalar_one_or_none()


async def _get_event(db: AsyncSession, event_id: int, user: User) -> Optional[CalendarEvent]:
    result = await db.execute(
        select(CalendarEvent).where(
            CalendarEvent.id == event_id, CalendarEvent.user_id == user.id
        )
    )
    return result.scalar_one_or_none()


async def link_job_event(
    db: AsyncSession, job_id: int, event_id: int, user: User
) -> bool:
    """Link a calendar event to a job. Returns False if job or event not found."""
    job = await _get_job(db, job_id, user)
    if job is None:
        return False
    event = await _get_event(db, event_id, user)
    if event is None:
        return False

    existing = await db.execute(
        select(JobEventLink).where(
            JobEventLink.job_id == job_id, JobEventLink.event_id == event_id
        )
    )
    if existing.scalar_one_or_none():
        return True

    db.add(JobEventLink(job_id=job_id, event_id=event_id))
    await db.commit()
    return True


async def unlink_job_event(
    db: AsyncSession, job_id: int, event_id: int, user: User
) -> bool:
    """Unlink a calendar event from a job. Returns False if job not found."""
    job = await _get_job(db, job_id, user)
    if job is None:
        return False

    await db.execute(
        delete(JobEventLink).where(
            JobEventLink.job_id == job_id, JobEventLink.event_id == event_id
        )
    )
    await db.commit()
    return True


async def get_job_linked_events(
    db: AsyncSession, job_id: int, user: User
) -> Optional[list[CalendarEvent]]:
    """Return calendar events linked to a job, or None if job not found."""
    job = await _get_job(db, job_id, user)
    if job is None:
        return None

    result = await db.execute(
        select(CalendarEvent)
        .join(JobEventLink, JobEventLink.event_id == CalendarEvent.id)
        .where(JobEventLink.job_id == job_id)
        .order_by(CalendarEvent.start_time)
    )
    return list(result.scalars().all())
