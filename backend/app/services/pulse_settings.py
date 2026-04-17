"""Service for managing Pulse settings."""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.scheduler import (
    schedule_user_birthday_check,
    schedule_user_digest,
    schedule_user_polling,
)
from app.models.telegram import PulseSettings
from app.schemas.pulse_settings import PulseSettingsUpdate


async def get_settings(db: AsyncSession, user_id: int) -> PulseSettings:
    """Get pulse settings for user, creating defaults if not exists."""
    result = await db.execute(
        select(PulseSettings).where(PulseSettings.user_id == user_id)
    )
    settings = result.scalar_one_or_none()

    if settings is None:
        settings = PulseSettings(user_id=user_id)
        db.add(settings)
        await db.flush()
        await db.refresh(settings)

    return settings


async def update_settings(
    db: AsyncSession, user_id: int, data: PulseSettingsUpdate
) -> PulseSettings:
    """Update pulse settings. Reschedule polling if interval changed."""
    settings = await get_settings(db, user_id)
    update_data = data.model_dump(exclude_unset=True)

    reschedule_polling = "polling_interval_minutes" in update_data
    digest_fields = {"digest_schedule", "digest_time", "digest_day", "digest_interval_days", "timezone"}
    reschedule_digest = bool(digest_fields & update_data.keys())
    reschedule_birthday = "timezone" in update_data

    for key, value in update_data.items():
        setattr(settings, key, value)

    await db.flush()
    await db.refresh(settings)

    if reschedule_polling:
        schedule_user_polling(user_id, settings.polling_interval_minutes)

    if reschedule_digest:
        hour = settings.digest_time.hour if settings.digest_time else 9
        minute = settings.digest_time.minute if settings.digest_time else 0
        schedule_user_digest(
            user_id,
            schedule=settings.digest_schedule,
            hour=hour,
            minute=minute,
            day_of_week=settings.digest_day,
            interval_days=settings.digest_interval_days,
            timezone=settings.timezone or "America/Denver",
        )

    if reschedule_birthday:
        schedule_user_birthday_check(
            user_id, settings.timezone or "America/Denver"
        )

    return settings
