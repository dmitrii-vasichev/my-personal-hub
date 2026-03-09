"""
Task reminder service — query and dismiss reminders.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.task import Task, TaskStatus
from app.models.user import User


async def get_due_reminders(db: AsyncSession, user: User) -> list[Task]:
    """Return tasks with reminder_at within the past or next 15 minutes, not dismissed."""
    now = datetime.now(tz=timezone.utc)
    window_end = now + timedelta(minutes=15)

    result = await db.execute(
        select(Task)
        .where(
            and_(
                Task.user_id == user.id,
                Task.reminder_at <= window_end,
                Task.reminder_dismissed.is_(False),
                Task.status.notin_([TaskStatus.done, TaskStatus.cancelled]),
            )
        )
        .order_by(Task.reminder_at)
    )
    return list(result.scalars().all())


async def dismiss_reminder(
    db: AsyncSession, task_id: int, user: User
) -> Optional[Task]:
    """Mark reminder_dismissed = True for the task. Returns None if not found/accessible."""
    result = await db.execute(
        select(Task).where(Task.id == task_id, Task.user_id == user.id)
    )
    task = result.scalar_one_or_none()
    if task is None:
        return None

    task.reminder_dismissed = True
    await db.commit()
    await db.refresh(task)
    return task
