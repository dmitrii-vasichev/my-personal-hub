"""Periodic reminder digest — sends Telegram summary of pending reminders."""

import logging
from datetime import datetime, timezone

from sqlalchemy import select, and_

from app.models.reminder import Reminder, ReminderStatus
from app.models.telegram import PulseSettings

logger = logging.getLogger(__name__)


async def run_reminder_digest() -> None:
    """Scheduled job: send periodic digest of pending reminders via Telegram."""
    from app.core.database import async_session_factory

    async with async_session_factory() as db:
        try:
            now = datetime.now(tz=timezone.utc)

            # Get all users with digest enabled
            ps_result = await db.execute(
                select(PulseSettings).where(
                    PulseSettings.digest_reminders_enabled == True,  # noqa: E712
                    PulseSettings.bot_token.isnot(None),
                    PulseSettings.bot_chat_id.isnot(None),
                )
            )
            all_settings = list(ps_result.scalars().all())

            for ps in all_settings:
                try:
                    await _process_user_digest(db, ps, now)
                except Exception as e:
                    logger.error(
                        "Digest failed for user %s: %s", ps.user_id, e
                    )

            await db.commit()

        except Exception as e:
            logger.error("Reminder digest check failed: %s", e)


async def _process_user_digest(db, ps: PulseSettings, now: datetime) -> None:
    """Check if it's time to send digest for this user, and send it."""
    from zoneinfo import ZoneInfo

    from app.core.encryption import decrypt_value

    tz_name = ps.timezone or "UTC"
    try:
        user_tz = ZoneInfo(tz_name)
    except Exception:
        user_tz = ZoneInfo("UTC")

    local_now = now.astimezone(user_tz)
    current_hour = local_now.hour

    # Check if within digest window
    if current_hour < ps.digest_reminders_start_hour:
        return
    if current_hour >= ps.digest_reminders_end_hour:
        return

    # Check if enough time has passed since last digest
    interval_seconds = ps.digest_reminders_interval_hours * 3600
    if ps.last_reminder_digest_at:
        elapsed = (now - ps.last_reminder_digest_at).total_seconds()
        if elapsed < interval_seconds:
            return

    # Fetch pending reminders for today
    today_start = local_now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = local_now.replace(hour=23, minute=59, second=59, microsecond=0)

    result = await db.execute(
        select(Reminder).where(
            and_(
                Reminder.user_id == ps.user_id,
                Reminder.status == ReminderStatus.pending,
                Reminder.remind_at >= today_start.astimezone(ZoneInfo("UTC")),
                Reminder.remind_at <= today_end.astimezone(ZoneInfo("UTC")),
            )
        ).order_by(
            Reminder.is_urgent.desc(),
            Reminder.is_floating.asc(),
            Reminder.remind_at,
        )
    )
    reminders = list(result.scalars().all())

    if not reminders:
        return

    # Build digest message
    text = _format_digest(reminders, user_tz)

    # Send via Telegram
    from telegram import Bot
    from telegram.error import TelegramError

    token = decrypt_value(ps.bot_token)
    try:
        bot = Bot(token=token)
        await bot.send_message(
            chat_id=ps.bot_chat_id,
            text=text,
            parse_mode="HTML",
        )
        ps.last_reminder_digest_at = now
        logger.info(
            "Sent reminder digest to user %s (%d items)", ps.user_id, len(reminders)
        )
    except TelegramError as e:
        logger.warning("Failed to send digest to user %s: %s", ps.user_id, e)


def _format_digest(reminders: list[Reminder], user_tz) -> str:
    """Format digest message with sections for urgent, time-bound, floating."""
    lines = ["\U0001f4cb <b>Reminders digest</b>\n"]

    urgent = [r for r in reminders if r.is_urgent and r.is_floating]
    timed = [r for r in reminders if not r.is_floating]
    floating = [r for r in reminders if r.is_floating and not r.is_urgent]

    if urgent:
        lines.append("\U0001f534 <b>Urgent:</b>")
        for r in urgent:
            lines.append(f"  \u2022 {r.title}")
        lines.append("")

    if timed:
        lines.append("\u23f0 <b>Scheduled:</b>")
        for r in timed:
            local_dt = r.remind_at.astimezone(user_tz)
            time_str = local_dt.strftime("%H:%M")
            prefix = "\U0001f534 " if r.is_urgent else ""
            lines.append(f"  \u2022 {prefix}{time_str} \u2014 {r.title}")
        lines.append("")

    if floating:
        lines.append("\U0001f4cc <b>Today:</b>")
        for r in floating:
            lines.append(f"  \u2022 {r.title}")
        lines.append("")

    return "\n".join(lines)
