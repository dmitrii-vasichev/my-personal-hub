"""Background task scheduler for Pulse polling and maintenance jobs."""
from __future__ import annotations

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


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
) -> None:
    """Schedule (or reschedule) digest generation for a user.

    Supports: daily, weekly, every_n_days.
    """
    job_id = f"pulse_digest_user_{user_id}"

    existing = scheduler.get_job(job_id)
    if existing:
        scheduler.remove_job(job_id)

    if schedule == "daily":
        scheduler.add_job(
            "app.services.pulse_scheduler:run_user_digest",
            "cron",
            hour=hour,
            minute=minute,
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
            id=job_id,
            args=[user_id],
            replace_existing=True,
            misfire_grace_time=3600,
        )

    logger.info(
        "Scheduled digest for user %s: schedule=%s hour=%s minute=%s",
        user_id, schedule, hour, minute,
    )


def remove_user_digest(user_id: int) -> None:
    """Remove digest generation job for a user."""
    job_id = f"pulse_digest_user_{user_id}"
    existing = scheduler.get_job(job_id)
    if existing:
        scheduler.remove_job(job_id)
        logger.info("Removed digest job for user %s", user_id)
