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
