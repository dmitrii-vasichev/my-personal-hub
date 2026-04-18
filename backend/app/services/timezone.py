"""Timezone-change side-effects for the User record.

Whenever a user's ``User.timezone`` value changes — through any entry point
(profile PUT, admin PATCH, or the legacy Pulse settings form) — the per-user
cron jobs that depend on local wall-clock time (digest + birthday check) must
be re-registered in the scheduler, otherwise they continue to fire at the old
timezone until the backend restarts.

This module concentrates that side-effect in a single helper so all callers
behave identically.
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.scheduler import (
    schedule_user_birthday_check,
    schedule_user_digest,
)
from app.models.telegram import PulseSettings


async def apply_user_timezone_change(
    db: AsyncSession, user_id: int, new_tz: str
) -> None:
    """Re-schedule per-user cron jobs after a timezone change.

    Looks up the user's :class:`PulseSettings` to pass digest schedule
    parameters (time / cadence / weekday / interval) to the digest scheduler.
    If no PulseSettings row exists, only the birthday check is rescheduled —
    the digest job can't run without settings anyway.

    The caller is responsible for having persisted ``User.timezone = new_tz``
    already; this helper only fires scheduler side-effects. Idempotent —
    APScheduler's ``replace_existing=True`` means repeated invocations with
    the same input produce the same job state.
    """
    result = await db.execute(
        select(PulseSettings).where(PulseSettings.user_id == user_id)
    )
    settings = result.scalar_one_or_none()

    if settings is not None:
        hour = settings.digest_time.hour if settings.digest_time else 9
        minute = settings.digest_time.minute if settings.digest_time else 0
        schedule_user_digest(
            user_id,
            schedule=settings.digest_schedule,
            hour=hour,
            minute=minute,
            day_of_week=settings.digest_day,
            interval_days=settings.digest_interval_days,
            timezone=new_tz or "UTC",
        )

    schedule_user_birthday_check(user_id, new_tz or "UTC")
