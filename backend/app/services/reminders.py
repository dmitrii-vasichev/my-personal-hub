"""Reminder CRUD service — create, list, update, delete, snooze, done."""

import logging
from datetime import date, datetime, time, timedelta, timezone
from typing import Optional

from dateutil.relativedelta import relativedelta
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.scheduler import cancel_reminder_notification, schedule_reminder_notification
from app.models.reminder import Reminder, ReminderStatus
from app.models.user import User

logger = logging.getLogger(__name__)


def _schedule_if_eligible(reminder: Reminder) -> None:
    """Schedule event-driven notification if reminder is pending and scheduled."""
    if reminder.status != ReminderStatus.pending or reminder.remind_at is None:
        return
    fire_at = reminder.snoozed_until or reminder.remind_at
    schedule_reminder_notification(reminder.id, fire_at)


async def create_reminder(
    db: AsyncSession,
    title: str,
    remind_at: datetime | None,
    user: User,
    action_date: date | None = None,
    recurrence_rule: str | None = None,
    is_floating: bool = False,
    is_urgent: bool = False,
    details: str | None = None,
    checklist: list[dict] | None = None,
) -> Reminder:
    reminder = Reminder(
        user_id=user.id,
        title=title,
        details=details,
        checklist=checklist or [],
        action_date=action_date or (remind_at.date() if remind_at else None),
        remind_at=None if is_floating else remind_at,
        recurrence_rule=recurrence_rule,
        is_floating=is_floating or remind_at is None,
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
            Reminder.action_date.asc().nullslast(),
            Reminder.remind_at.asc().nullslast(),
            Reminder.created_at.asc(),
        )
    result = await db.execute(
        select(Reminder).where(and_(*conditions)).order_by(*order)
    )
    return list(result.scalars().all())


async def get_reminder(
    db: AsyncSession,
    reminder_id: int,
    user: User,
) -> Optional[Reminder]:
    result = await db.execute(
        select(Reminder).where(Reminder.id == reminder_id, Reminder.user_id == user.id)
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

    if "remind_at" in kwargs:
        new_remind_at = kwargs["remind_at"]
        if kwargs.get("action_date") is None and new_remind_at is not None:
            kwargs["action_date"] = new_remind_at.date()
        if kwargs.get("is_floating") is True:
            kwargs["remind_at"] = None
        kwargs["is_floating"] = kwargs["remind_at"] is None
    elif kwargs.get("is_floating") is True:
        kwargs["remind_at"] = None

    for key, value in kwargs.items():
        if key == "checklist" and value is None:
            value = []
        setattr(reminder, key, value)

    # Reset notification state if remind_at changed
    if "remind_at" in kwargs:
        new_remind_at = kwargs["remind_at"]
        now = datetime.now(tz=timezone.utc)
        # Count as postpone: reminder was due (past or now) and moved forward
        if (
            old_remind_at is not None
            and new_remind_at is not None
            and old_remind_at <= now
            and new_remind_at > old_remind_at
        ):
            reminder.snooze_count += 1
        reminder.notification_sent_count = 0
        reminder.snoozed_until = None
        reminder.telegram_message_id = None
        cancel_reminder_notification(reminder_id)

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
        if reminder.remind_at is not None:
            reminder.remind_at = _next_occurrence(
                reminder.remind_at, reminder.recurrence_rule
            )
            reminder.action_date = reminder.remind_at.date()
        elif reminder.action_date is not None:
            reminder.action_date = _next_anytime_date(
                reminder.action_date, reminder.recurrence_rule
            )
        reminder.checklist = _reset_checklist_completion(reminder.checklist)
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
    reminder.action_date = datetime.now(tz=timezone.utc).date()
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
    if reminder.remind_at is None:
        raise ValueError("Only scheduled reminders can be snoozed")

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


def _next_anytime_date(current: date, rule: str) -> date:
    anchor = datetime.combine(current, time.min, tzinfo=timezone.utc)
    return _next_occurrence(anchor, rule).date()


def _reset_checklist_completion(checklist: object) -> list[dict]:
    """Return a checklist copy with all items unchecked for the next recurrence."""
    if not isinstance(checklist, list):
        return []
    reset_items: list[dict] = []
    for item in checklist:
        if not isinstance(item, dict):
            continue
        reset_items.append({**item, "completed": False})
    return reset_items
