from __future__ import annotations

from typing import Optional

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.task import Task
from app.models.calendar import CalendarEvent
from app.models.task_event_link import TaskEventLink
from app.models.user import User


async def _get_task(db: AsyncSession, task_id: int, user: User) -> Optional[Task]:
    result = await db.execute(
        select(Task).where(Task.id == task_id, Task.user_id == user.id)
    )
    return result.scalar_one_or_none()


async def _get_event(db: AsyncSession, event_id: int, user: User) -> Optional[CalendarEvent]:
    result = await db.execute(
        select(CalendarEvent).where(
            CalendarEvent.id == event_id, CalendarEvent.user_id == user.id
        )
    )
    return result.scalar_one_or_none()


async def link_task_event(
    db: AsyncSession, task_id: int, event_id: int, user: User
) -> bool:
    """Link a task to a calendar event. Returns False if task or event not found."""
    task = await _get_task(db, task_id, user)
    if task is None:
        return False
    event = await _get_event(db, event_id, user)
    if event is None:
        return False

    # Check if link already exists
    existing = await db.execute(
        select(TaskEventLink).where(
            TaskEventLink.task_id == task_id, TaskEventLink.event_id == event_id
        )
    )
    if existing.scalar_one_or_none():
        return True  # Already linked — idempotent

    db.add(TaskEventLink(task_id=task_id, event_id=event_id))
    await db.commit()
    return True


async def unlink_task_event(
    db: AsyncSession, task_id: int, event_id: int, user: User
) -> bool:
    """Unlink a task from a calendar event. Returns False if task not found."""
    task = await _get_task(db, task_id, user)
    if task is None:
        return False

    await db.execute(
        delete(TaskEventLink).where(
            TaskEventLink.task_id == task_id, TaskEventLink.event_id == event_id
        )
    )
    await db.commit()
    return True


async def get_linked_events(
    db: AsyncSession, task_id: int, user: User
) -> Optional[list[CalendarEvent]]:
    """Return calendar events linked to a task, or None if task not found."""
    task = await _get_task(db, task_id, user)
    if task is None:
        return None

    result = await db.execute(
        select(CalendarEvent)
        .join(TaskEventLink, TaskEventLink.event_id == CalendarEvent.id)
        .where(TaskEventLink.task_id == task_id)
        .order_by(CalendarEvent.start_time)
    )
    return list(result.scalars().all())


async def get_linked_tasks(
    db: AsyncSession, event_id: int, user: User
) -> Optional[list[Task]]:
    """Return tasks linked to a calendar event, or None if event not found."""
    event = await _get_event(db, event_id, user)
    if event is None:
        return None

    result = await db.execute(
        select(Task)
        .join(TaskEventLink, TaskEventLink.task_id == Task.id)
        .where(TaskEventLink.event_id == event_id)
        .order_by(Task.id)
    )
    return list(result.scalars().all())
