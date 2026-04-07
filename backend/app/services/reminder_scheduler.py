"""Unified reminder scheduler — replaces old task_reminders.run_reminder_check."""

import logging
from datetime import datetime, timezone

from sqlalchemy import select, and_

from app.models.reminder import Reminder, ReminderStatus
from app.models.telegram import PulseSettings

logger = logging.getLogger(__name__)


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
                        Reminder.is_floating == False,  # noqa: E712
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
                tz_name = ps.timezone or "UTC"

                sent_count = 0
                for reminder in user_reminders:
                    if reminder.notification_sent_count >= max_notifications:
                        continue

                    # Throttle repeat notifications by configured interval
                    if reminder.notification_sent_count > 0:
                        minutes_since_last = (now - reminder.updated_at).total_seconds() / 60
                        if minutes_since_last < repeat_interval:
                            continue

                    # Format time in user's timezone
                    try:
                        from zoneinfo import ZoneInfo

                        local_dt = reminder.remind_at.astimezone(ZoneInfo(tz_name))
                        time_str = local_dt.strftime("%b %d, %Y %I:%M %p")
                    except Exception:
                        time_str = reminder.remind_at.strftime(
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
