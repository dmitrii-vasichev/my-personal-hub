"""Action CRUD service backed by reminders."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from typing import Optional
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.scheduler import cancel_reminder_notification, schedule_reminder_notification
from app.models.reminder import Reminder, ReminderStatus
from app.models.user import User
from app.services.reminders import _next_occurrence, _reset_checklist_completion


def _today_for_user(user: User) -> date:
    try:
        tz = ZoneInfo(user.timezone or "UTC")
    except Exception:
        tz = ZoneInfo("UTC")
    return datetime.now(tz).date()


def _schedule_if_eligible(action: Reminder) -> None:
    if action.status != ReminderStatus.pending or action.remind_at is None:
        return
    fire_at = action.snoozed_until or action.remind_at
    schedule_reminder_notification(action.id, fire_at)


def _derive_action_date(remind_at: datetime | None, action_date: date | None) -> date | None:
    if action_date is not None:
        return action_date
    if remind_at is not None:
        return remind_at.date()
    return None


def _sort_key(action: Reminder, today: date) -> tuple:
    is_inbox = action.action_date is None and action.remind_at is None
    action_day = action.action_date
    if is_inbox:
        group_rank = 3
        day_rank = date.max
    elif action_day is not None and action_day < today:
        group_rank = 0
        day_rank = action_day
    elif action_day == today:
        group_rank = 1
        day_rank = action_day
    else:
        group_rank = 2
        day_rank = action_day or date.max

    if action.remind_at is not None:
        section_rank = 0
        urgent_rank = 1
        time_rank = action.remind_at
    else:
        section_rank = 1
        urgent_rank = 0 if action.is_urgent else 1
        time_rank = datetime.max.replace(tzinfo=timezone.utc)

    created = action.created_at or datetime.min.replace(tzinfo=timezone.utc)
    return (group_rank, day_rank, section_rank, urgent_rank, time_rank, created, action.id)


def sort_actions_for_list(actions: list[Reminder], user: User) -> list[Reminder]:
    today = _today_for_user(user)
    return sorted(actions, key=lambda action: _sort_key(action, today))


async def create_action(
    db: AsyncSession,
    title: str,
    user: User,
    action_date: date | None = None,
    remind_at: datetime | None = None,
    recurrence_rule: str | None = None,
    task_id: int | None = None,
    is_urgent: bool = False,
    details: str | None = None,
    checklist: list[dict] | None = None,
) -> Reminder:
    action = Reminder(
        user_id=user.id,
        title=title,
        details=details,
        checklist=checklist or [],
        action_date=_derive_action_date(remind_at, action_date),
        remind_at=remind_at,
        recurrence_rule=recurrence_rule,
        task_id=task_id,
        is_floating=remind_at is None,
        is_urgent=is_urgent,
    )
    db.add(action)
    await db.commit()
    await db.refresh(action)
    if action.remind_at is not None:
        _schedule_if_eligible(action)
    return action


async def list_actions(
    db: AsyncSession,
    user: User,
    include_done: bool = False,
    status_filter: ReminderStatus | None = None,
) -> list[Reminder]:
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
        select(Reminder)
        .options(selectinload(Reminder.task))
        .where(and_(*conditions))
        .order_by(*order)
    )
    actions = list(result.scalars().all())
    if status_filter == ReminderStatus.done:
        return actions
    return sort_actions_for_list(actions, user)


async def get_action(
    db: AsyncSession,
    action_id: int,
    user: User,
) -> Optional[Reminder]:
    result = await db.execute(
        select(Reminder)
        .options(selectinload(Reminder.task))
        .where(Reminder.id == action_id, Reminder.user_id == user.id)
    )
    return result.scalar_one_or_none()


async def update_action(
    db: AsyncSession,
    action_id: int,
    user: User,
    **kwargs: object,
) -> Optional[Reminder]:
    action = await get_action(db, action_id, user)
    if not action:
        return None

    old_remind_at = action.remind_at
    if "remind_at" in kwargs:
        kwargs["action_date"] = _derive_action_date(
            kwargs["remind_at"], kwargs.get("action_date", action.action_date)
        )
        kwargs["is_floating"] = kwargs["remind_at"] is None
    elif "action_date" in kwargs and kwargs["action_date"] is None:
        kwargs["remind_at"] = None
        kwargs["is_floating"] = True

    for key, value in kwargs.items():
        if key == "checklist" and value is None:
            value = []
        setattr(action, key, value)

    if "remind_at" in kwargs and old_remind_at != action.remind_at:
        now = datetime.now(tz=timezone.utc)
        if (
            old_remind_at is not None
            and action.remind_at is not None
            and old_remind_at <= now
            and action.remind_at > old_remind_at
        ):
            action.snooze_count += 1
        action.notification_sent_count = 0
        action.snoozed_until = None
        action.telegram_message_id = None
        cancel_reminder_notification(action_id)

    await db.commit()
    await db.refresh(action)
    _schedule_if_eligible(action)
    return action


async def delete_action(
    db: AsyncSession,
    action_id: int,
    user: User,
) -> bool:
    action = await get_action(db, action_id, user)
    if not action:
        return False
    await db.delete(action)
    await db.commit()
    cancel_reminder_notification(action_id)
    return True


def _next_anytime_date(current: date, rule: str) -> date:
    anchor = datetime.combine(current, time.min, tzinfo=timezone.utc)
    return _next_occurrence(anchor, rule).date()


async def mark_done(
    db: AsyncSession,
    action_id: int,
    user: User,
) -> Optional[Reminder]:
    action = await get_action(db, action_id, user)
    if not action:
        return None

    if action.recurrence_rule:
        if action.remind_at is not None:
            action.remind_at = _next_occurrence(action.remind_at, action.recurrence_rule)
            action.action_date = action.remind_at.date()
        elif action.action_date is not None:
            action.action_date = _next_anytime_date(action.action_date, action.recurrence_rule)
        action.checklist = _reset_checklist_completion(action.checklist)
        action.status = ReminderStatus.pending
        action.snooze_count = 0
        action.notification_sent_count = 0
        action.snoozed_until = None
        action.telegram_message_id = None
    else:
        action.status = ReminderStatus.done
        action.completed_at = datetime.now(tz=timezone.utc)

    await db.commit()
    await db.refresh(action)

    if action.recurrence_rule and action.status == ReminderStatus.pending:
        _schedule_if_eligible(action)
    else:
        cancel_reminder_notification(action_id)
    return action


async def restore_action(
    db: AsyncSession,
    action_id: int,
    user: User,
) -> Optional[Reminder]:
    action = await get_action(db, action_id, user)
    if not action or action.status != ReminderStatus.done:
        return None
    action.status = ReminderStatus.pending
    action.completed_at = None
    if action.action_date is None and action.remind_at is None:
        action.action_date = _today_for_user(user)
    await db.commit()
    await db.refresh(action)
    _schedule_if_eligible(action)
    return action


async def snooze_action(
    db: AsyncSession,
    action_id: int,
    user: User,
    minutes: int,
) -> Optional[Reminder]:
    action = await get_action(db, action_id, user)
    if not action:
        return None
    if action.remind_at is None:
        raise HTTPException(status_code=400, detail="Only scheduled actions can be snoozed")

    now = datetime.now(tz=timezone.utc)
    base = max(action.remind_at, now)
    new_time = base + timedelta(minutes=minutes)
    action.snoozed_until = new_time
    action.snooze_count += 1
    action.notification_sent_count = 0
    action.telegram_message_id = None
    await db.commit()
    await db.refresh(action)
    _schedule_if_eligible(action)
    return action
