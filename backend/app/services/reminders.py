"""Reminder CRUD service — create, list, update, delete, snooze, done."""

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from dateutil.relativedelta import relativedelta
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.scheduler import cancel_reminder_notification, schedule_reminder_notification
from app.models.reminder import Reminder, ReminderStatus
from app.models.user import User

logger = logging.getLogger(__name__)


def _schedule_if_eligible(reminder: Reminder) -> None:
    """Schedule event-driven notification if reminder is pending and time-bound."""
    if reminder.is_floating or reminder.status != ReminderStatus.pending:
        return
    fire_at = reminder.snoozed_until or reminder.remind_at
    schedule_reminder_notification(reminder.id, fire_at)


async def create_reminder(
    db: AsyncSession,
    title: str,
    remind_at: datetime,
    user: User,
    recurrence_rule: str | None = None,
    task_id: int | None = None,
    is_floating: bool = False,
    is_urgent: bool = False,
) -> Reminder:
    reminder = Reminder(
        user_id=user.id,
        title=title,
        remind_at=remind_at,
        recurrence_rule=recurrence_rule,
        task_id=task_id,
        is_floating=is_floating,
        is_urgent=is_urgent,
    )
    db.add(reminder)
    await db.commit()
    await db.refresh(reminder)
    _schedule_if_eligible(reminder)
    return reminder


async def list_reminders(
    db: AsyncSession,
    user: User,
    include_done: bool = False,
    status_filter: ReminderStatus | None = None,
) -> list[Reminder]:
    """List reminders. Use status_filter to get only pending/done."""
    conditions = [Reminder.user_id == user.id]
    if status_filter:
        conditions.append(Reminder.status == status_filter)
    elif not include_done:
        conditions.append(Reminder.status == ReminderStatus.pending)

    if status_filter == ReminderStatus.done:
        order = (Reminder.completed_at.desc().nullslast(),)
    else:
        order = (
            Reminder.is_urgent.desc(),    # urgent first
            Reminder.is_floating.asc(),   # time-bound before floating
            Reminder.remind_at,           # then by time
        )
    result = await db.execute(
        select(Reminder)
        .options(selectinload(Reminder.task))
        .where(and_(*conditions))
        .order_by(*order)
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

    old_remind_at = reminder.remind_at

    for key, value in kwargs.items():
        setattr(reminder, key, value)

    # Reset notification state if remind_at changed
    if "remind_at" in kwargs:
        new_remind_at = kwargs["remind_at"]
        now = datetime.now(tz=timezone.utc)
        # Count as postpone: reminder was due (past or now) and moved forward
        if old_remind_at <= now and new_remind_at > old_remind_at:
            reminder.snooze_count += 1
        reminder.notification_sent_count = 0
        reminder.snoozed_until = None
        reminder.telegram_message_id = None

    await db.commit()
    await db.refresh(reminder)
    _schedule_if_eligible(reminder)
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
    cancel_reminder_notification(reminder_id)
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
        reminder.completed_at = datetime.now(tz=timezone.utc)

    await db.commit()
    await db.refresh(reminder)

    if reminder.recurrence_rule and reminder.status == ReminderStatus.pending:
        _schedule_if_eligible(reminder)
    else:
        cancel_reminder_notification(reminder_id)

    return reminder


async def restore_reminder(
    db: AsyncSession,
    reminder_id: int,
    user: User,
) -> Optional[Reminder]:
    """Restore a completed reminder back to pending."""
    reminder = await get_reminder(db, reminder_id, user)
    if not reminder or reminder.status != ReminderStatus.done:
        return None
    reminder.status = ReminderStatus.pending
    reminder.completed_at = None
    reminder.remind_at = datetime.now(tz=timezone.utc)
    await db.commit()
    await db.refresh(reminder)
    _schedule_if_eligible(reminder)
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

    now = datetime.now(tz=timezone.utc)
    base = max(reminder.remind_at, now)
    new_time = base + timedelta(minutes=minutes)
    # Only set snoozed_until — keep remind_at unchanged so recurring
    # reminders return to their original schedule after mark_done.
    reminder.snoozed_until = new_time
    reminder.snooze_count += 1
    reminder.notification_sent_count = 0
    reminder.telegram_message_id = None
    await db.commit()
    await db.refresh(reminder)
    _schedule_if_eligible(reminder)
    return reminder


_DAY_MAP = {"mon": 0, "tue": 1, "wed": 2, "thu": 3, "fri": 4, "sat": 5, "sun": 6}


def _next_occurrence(current: datetime, rule: str) -> datetime:
    """Calculate next occurrence based on recurrence rule."""
    if rule.startswith("custom:"):
        days = [_DAY_MAP[d] for d in rule[7:].split(",") if d in _DAY_MAP]
        if not days:
            return current + timedelta(days=1)
        for i in range(1, 8):
            candidate = current + timedelta(days=i)
            if candidate.weekday() in days:
                return candidate

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
