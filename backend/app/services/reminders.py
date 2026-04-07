"""Reminder CRUD service — create, list, update, delete, snooze, done."""

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from dateutil.relativedelta import relativedelta
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.reminder import Reminder, ReminderStatus
from app.models.user import User

logger = logging.getLogger(__name__)


async def create_reminder(
    db: AsyncSession,
    title: str,
    remind_at: datetime,
    user: User,
    recurrence_rule: str | None = None,
    task_id: int | None = None,
) -> Reminder:
    reminder = Reminder(
        user_id=user.id,
        title=title,
        remind_at=remind_at,
        recurrence_rule=recurrence_rule,
        task_id=task_id,
    )
    db.add(reminder)
    await db.commit()
    await db.refresh(reminder)
    return reminder


async def list_reminders(
    db: AsyncSession,
    user: User,
    include_done: bool = False,
) -> list[Reminder]:
    """List reminders grouped by date (returned sorted by remind_at)."""
    conditions = [Reminder.user_id == user.id]
    if not include_done:
        conditions.append(Reminder.status == ReminderStatus.pending)
    result = await db.execute(
        select(Reminder)
        .options(selectinload(Reminder.task))
        .where(and_(*conditions))
        .order_by(Reminder.remind_at)
    )
    return list(result.scalars().all())


async def get_reminder(
    db: AsyncSession,
    reminder_id: int,
    user: User,
) -> Optional[Reminder]:
    result = await db.execute(
        select(Reminder)
        .options(selectinload(Reminder.task))
        .where(Reminder.id == reminder_id, Reminder.user_id == user.id)
    )
    return result.scalar_one_or_none()


async def update_reminder(
    db: AsyncSession,
    reminder_id: int,
    user: User,
    **kwargs: object,
) -> Optional[Reminder]:
    reminder = await get_reminder(db, reminder_id, user)
    if not reminder:
        return None
    for key, value in kwargs.items():
        setattr(reminder, key, value)
    # Reset notification state if remind_at changed
    if "remind_at" in kwargs:
        reminder.notification_sent_count = 0
        reminder.snoozed_until = None
        reminder.telegram_message_id = None
    await db.commit()
    await db.refresh(reminder)
    return reminder


async def delete_reminder(
    db: AsyncSession,
    reminder_id: int,
    user: User,
) -> bool:
    reminder = await get_reminder(db, reminder_id, user)
    if not reminder:
        return False
    await db.delete(reminder)
    await db.commit()
    return True


async def mark_done(
    db: AsyncSession,
    reminder_id: int,
    user: User,
) -> Optional[Reminder]:
    reminder = await get_reminder(db, reminder_id, user)
    if not reminder:
        return None

    if reminder.recurrence_rule:
        # Advance to next occurrence
        reminder.remind_at = _next_occurrence(
            reminder.remind_at, reminder.recurrence_rule
        )
        reminder.status = ReminderStatus.pending
        reminder.snooze_count = 0
        reminder.notification_sent_count = 0
        reminder.snoozed_until = None
        reminder.telegram_message_id = None
    else:
        reminder.status = ReminderStatus.done

    await db.commit()
    await db.refresh(reminder)
    return reminder


async def snooze_reminder(
    db: AsyncSession,
    reminder_id: int,
    user: User,
    minutes: int,
) -> Optional[Reminder]:
    reminder = await get_reminder(db, reminder_id, user)
    if not reminder:
        return None

    reminder.snoozed_until = datetime.now(tz=timezone.utc) + timedelta(
        minutes=minutes
    )
    reminder.snooze_count += 1
    reminder.notification_sent_count = 0
    reminder.telegram_message_id = None
    await db.commit()
    await db.refresh(reminder)
    return reminder


def _next_occurrence(current: datetime, rule: str) -> datetime:
    """Calculate next occurrence based on recurrence rule."""
    match rule:
        case "daily":
            return current + timedelta(days=1)
        case "weekly":
            return current + timedelta(weeks=1)
        case "monthly":
            return current + relativedelta(months=1)
        case "yearly":
            return current + relativedelta(years=1)
        case _:
            logger.warning("Unknown recurrence rule: %s, defaulting to daily", rule)
            return current + timedelta(days=1)


async def get_reminder_by_task(
    db: AsyncSession,
    task_id: int,
    user: User,
) -> Optional[Reminder]:
    """Get reminder linked to a task."""
    result = await db.execute(
        select(Reminder).where(
            Reminder.task_id == task_id, Reminder.user_id == user.id
        )
    )
    return result.scalar_one_or_none()
