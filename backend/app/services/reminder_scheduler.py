"""Unified reminder scheduler — event-driven + polling safety net."""

import logging
from datetime import datetime, timezone

from sqlalchemy import select, and_

from app.models.reminder import Reminder, ReminderStatus
from app.models.telegram import PulseSettings
from app.models.user import User

logger = logging.getLogger(__name__)


async def fire_single_reminder(reminder_id: int) -> None:
    """Event-driven job: send first notification for a specific reminder at exact time."""
    from app.core.database import async_session_factory
    from app.core.encryption import decrypt_value
    from app.services.reminder_notifications import send_reminder_notification

    async with async_session_factory() as db:
        try:
            result = await db.execute(
                select(Reminder).where(Reminder.id == reminder_id)
            )
            reminder = result.scalar_one_or_none()
            if not reminder or reminder.status != ReminderStatus.pending:
                return
            if reminder.remind_at is None:
                return
            if reminder.notification_sent_count > 0:
                return  # already sent, let polling handle repeats

            now = datetime.now(tz=timezone.utc)
            if reminder.snoozed_until and reminder.snoozed_until > now:
                return  # re-snoozed since scheduling, new job will handle it

            ps_result = await db.execute(
                select(PulseSettings).where(
                    PulseSettings.user_id == reminder.user_id
                )
            )
            ps = ps_result.scalar_one_or_none()
            if not ps or not ps.bot_token or not ps.bot_chat_id:
                return

            token = decrypt_value(ps.bot_token)
            tz_result = await db.execute(
                select(User.timezone).where(User.id == reminder.user_id)
            )
            tz_name = tz_result.scalar() or "UTC"

            display_dt = reminder.snoozed_until or reminder.remind_at
            try:
                from zoneinfo import ZoneInfo

                local_dt = display_dt.astimezone(ZoneInfo(tz_name))
                time_str = local_dt.strftime("%b %d, %Y %I:%M %p")
            except Exception:
                time_str = display_dt.strftime("%b %d, %Y %H:%M UTC")

            res = await send_reminder_notification(
                bot_token=token,
                chat_id=ps.bot_chat_id,
                reminder_id=reminder.id,
                title=reminder.title,
                time_str=time_str,
                snooze_count=reminder.snooze_count,
                snooze_limit=ps.reminder_snooze_limit,
            )
            if res["success"]:
                reminder.notification_sent_count += 1
                if res.get("message_id"):
                    reminder.telegram_message_id = res["message_id"]
                await db.commit()
                logger.info(
                    "Event-driven notification sent for reminder %s",
                    reminder_id,
                )

        except Exception as e:
            logger.error(
                "Event-driven reminder %s failed: %s", reminder_id, e
            )


async def run_reminder_check() -> None:
    """Scheduled job: find due reminders, send Telegram notifications."""
    from app.core.database import async_session_factory
    from app.core.encryption import decrypt_value
    from app.services.reminder_notifications import send_reminder_notification

    async with async_session_factory() as db:
        try:
            now = datetime.now(tz=timezone.utc)

            result = await db.execute(
                select(Reminder).where(
                    and_(
                        Reminder.status == ReminderStatus.pending,
                        Reminder.remind_at.is_not(None),
                        Reminder.remind_at <= now,
                        # Either not snoozed, or snooze expired
                        (Reminder.snoozed_until.is_(None))
                        | (Reminder.snoozed_until <= now),
                    )
                )
            )
            reminders = list(result.scalars().all())
            if not reminders:
                return

            # Group by user_id
            by_user: dict[int, list[Reminder]] = {}
            for r in reminders:
                by_user.setdefault(r.user_id, []).append(r)

            for user_id, user_reminders in by_user.items():
                ps_result = await db.execute(
                    select(PulseSettings).where(PulseSettings.user_id == user_id)
                )
                ps = ps_result.scalar_one_or_none()
                if not ps or not ps.bot_token or not ps.bot_chat_id:
                    continue

                token = decrypt_value(ps.bot_token)
                max_notifications = ps.reminder_repeat_count
                repeat_interval = ps.reminder_repeat_interval
                snooze_limit = ps.reminder_snooze_limit
                tz_result = await db.execute(
                    select(User.timezone).where(User.id == user_id)
                )
                tz_name = tz_result.scalar() or "UTC"

                sent_count = 0
                for reminder in user_reminders:
                    if reminder.notification_sent_count >= max_notifications:
                        continue

                    # Throttle repeat notifications by configured interval
                    if reminder.notification_sent_count > 0:
                        minutes_since_last = (now - reminder.updated_at).total_seconds() / 60
                        if minutes_since_last < repeat_interval:
                            continue

                    # Show snoozed time when applicable
                    display_dt = reminder.snoozed_until or reminder.remind_at
                    # Format time in user's timezone
                    try:
                        from zoneinfo import ZoneInfo

                        local_dt = display_dt.astimezone(ZoneInfo(tz_name))
                        time_str = local_dt.strftime("%b %d, %Y %I:%M %p")
                    except Exception:
                        time_str = display_dt.strftime(
                            "%b %d, %Y %H:%M UTC"
                        )

                    res = await send_reminder_notification(
                        bot_token=token,
                        chat_id=ps.bot_chat_id,
                        reminder_id=reminder.id,
                        title=reminder.title,
                        time_str=time_str,
                        snooze_count=reminder.snooze_count,
                        snooze_limit=snooze_limit,
                    )
                    if res["success"]:
                        sent_count += 1
                        reminder.notification_sent_count += 1
                        if res.get("message_id"):
                            reminder.telegram_message_id = res["message_id"]

                await db.commit()
                if sent_count:
                    logger.info(
                        "Sent %d reminder notification(s) for user %s",
                        sent_count,
                        user_id,
                    )

        except Exception as e:
            logger.error("Reminder check failed: %s", e)
