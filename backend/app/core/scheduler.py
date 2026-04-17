"""Background task scheduler for Pulse polling and maintenance jobs."""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from apscheduler.schedulers.asyncio import AsyncIOScheduler

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


# --------------- Reminder event-driven scheduling ---------------


def schedule_reminder_notification(reminder_id: int, fire_at: datetime) -> None:
    """Schedule a one-shot job to send notification at exact fire_at time."""
    job_id = f"reminder_notify_{reminder_id}"

    existing = scheduler.get_job(job_id)
    if existing:
        scheduler.remove_job(job_id)

    now = datetime.now(tz=timezone.utc)
    if fire_at <= now:
        fire_at = now  # already due — fire immediately

    scheduler.add_job(
        "app.services.reminder_scheduler:fire_single_reminder",
        "date",
        run_date=fire_at,
        id=job_id,
        args=[reminder_id],
        replace_existing=True,
        misfire_grace_time=300,
    )
    logger.info("Scheduled reminder %s notification at %s", reminder_id, fire_at)


def cancel_reminder_notification(reminder_id: int) -> None:
    """Cancel a scheduled reminder notification job."""
    job_id = f"reminder_notify_{reminder_id}"
    existing = scheduler.get_job(job_id)
    if existing:
        scheduler.remove_job(job_id)
        logger.info("Cancelled reminder %s notification", reminder_id)


def schedule_user_polling(user_id: int, interval_minutes: int) -> None:
    """Schedule (or reschedule) periodic polling for a user."""
    job_id = f"pulse_poll_user_{user_id}"

    # Remove existing job if any
    existing = scheduler.get_job(job_id)
    if existing:
        scheduler.remove_job(job_id)

    scheduler.add_job(
        "app.services.pulse_scheduler:run_user_poll",
        "interval",
        minutes=interval_minutes,
        id=job_id,
        args=[user_id],
        replace_existing=True,
        misfire_grace_time=300,
    )
    logger.info("Scheduled polling for user %s every %s min", user_id, interval_minutes)


def remove_user_polling(user_id: int) -> None:
    """Remove polling job for a user."""
    job_id = f"pulse_poll_user_{user_id}"
    existing = scheduler.get_job(job_id)
    if existing:
        scheduler.remove_job(job_id)
        logger.info("Removed polling job for user %s", user_id)


def schedule_user_digest(
    user_id: int,
    schedule: str,
    hour: int = 9,
    minute: int = 0,
    day_of_week: int | None = None,
    interval_days: int | None = None,
    timezone: str = "America/Denver",
) -> None:
    """Schedule (or reschedule) digest generation for a user.

    Supports: daily, weekly, every_n_days.
    The timezone parameter ensures cron jobs fire at the user's local time.
    """
    job_id = f"pulse_digest_user_{user_id}"

    existing = scheduler.get_job(job_id)
    if existing:
        scheduler.remove_job(job_id)

    try:
        tz = ZoneInfo(timezone)
    except (KeyError, ValueError):
        logger.warning("Invalid timezone '%s' for user %s, falling back to America/Denver", timezone, user_id)
        tz = ZoneInfo("America/Denver")

    if schedule == "daily":
        scheduler.add_job(
            "app.services.pulse_scheduler:run_user_digest",
            "cron",
            hour=hour,
            minute=minute,
            timezone=tz,
            id=job_id,
            args=[user_id],
            replace_existing=True,
            misfire_grace_time=3600,
        )
    elif schedule == "weekly" and day_of_week is not None:
        scheduler.add_job(
            "app.services.pulse_scheduler:run_user_digest",
            "cron",
            day_of_week=day_of_week,
            hour=hour,
            minute=minute,
            timezone=tz,
            id=job_id,
            args=[user_id],
            replace_existing=True,
            misfire_grace_time=3600,
        )
    elif schedule == "every_n_days" and interval_days:
        scheduler.add_job(
            "app.services.pulse_scheduler:run_user_digest",
            "interval",
            days=interval_days,
            id=job_id,
            args=[user_id],
            replace_existing=True,
            misfire_grace_time=3600,
        )
    else:
        # Fallback: daily at the given time
        scheduler.add_job(
            "app.services.pulse_scheduler:run_user_digest",
            "cron",
            hour=hour,
            minute=minute,
            timezone=tz,
            id=job_id,
            args=[user_id],
            replace_existing=True,
            misfire_grace_time=3600,
        )

    logger.info(
        "Scheduled digest for user %s: schedule=%s hour=%s minute=%s tz=%s",
        user_id, schedule, hour, minute, timezone,
    )


def remove_user_digest(user_id: int) -> None:
    """Remove digest generation job for a user."""
    job_id = f"pulse_digest_user_{user_id}"
    existing = scheduler.get_job(job_id)
    if existing:
        scheduler.remove_job(job_id)
        logger.info("Removed digest job for user %s", user_id)


def schedule_user_birthday_check(
    user_id: int, timezone: str = "America/Denver"
) -> None:
    """Schedule daily birthday reminder generation at 00:05 in user's timezone.

    Running in user-local time ensures the reminder row is created before
    reminder_time passes in the user's day, so polling doesn't fire it late.
    """
    job_id = f"birthday_check_user_{user_id}"

    existing = scheduler.get_job(job_id)
    if existing:
        scheduler.remove_job(job_id)

    try:
        tz = ZoneInfo(timezone)
    except (KeyError, ValueError):
        logger.warning(
            "Invalid timezone '%s' for user %s birthday check, falling back to America/Denver",
            timezone, user_id,
        )
        tz = ZoneInfo("America/Denver")

    scheduler.add_job(
        "app.services.birthday_scheduler:run_user_birthday_check",
        "cron",
        hour=0,
        minute=5,
        timezone=tz,
        id=job_id,
        args=[user_id],
        replace_existing=True,
        misfire_grace_time=3600,
    )
    logger.info(
        "Scheduled birthday check for user %s at 00:05 %s", user_id, timezone
    )


def remove_user_birthday_check(user_id: int) -> None:
    """Remove birthday check job for a user."""
    job_id = f"birthday_check_user_{user_id}"
    existing = scheduler.get_job(job_id)
    if existing:
        scheduler.remove_job(job_id)
        logger.info("Removed birthday check for user %s", user_id)


def schedule_garmin_sync(user_id: int, interval_minutes: int) -> None:
    """Schedule (or reschedule) periodic Garmin sync for a user."""
    job_id = f"garmin_sync_{user_id}"

    existing = scheduler.get_job(job_id)
    if existing:
        scheduler.remove_job(job_id)

    scheduler.add_job(
        "app.services.garmin_sync:run_garmin_sync",
        "interval",
        minutes=interval_minutes,
        id=job_id,
        args=[user_id],
        replace_existing=True,
        misfire_grace_time=300,
    )
    logger.info("Scheduled Garmin sync for user %s every %s min", user_id, interval_minutes)


def remove_garmin_sync(user_id: int) -> None:
    """Remove Garmin sync job for a user."""
    job_id = f"garmin_sync_{user_id}"
    existing = scheduler.get_job(job_id)
    if existing:
        scheduler.remove_job(job_id)
        logger.info("Removed Garmin sync job for user %s", user_id)
