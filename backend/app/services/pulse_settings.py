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
from app.models.user import User
from app.schemas.pulse_settings import PulseSettingsUpdate


async def _get_user_timezone(db: AsyncSession, user_id: int) -> str:
    """Look up the User.timezone (fallback to UTC)."""
    result = await db.execute(select(User.timezone).where(User.id == user_id))
    return result.scalar() or "UTC"


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
    """Update pulse settings. Reschedule polling if interval changed.

    ``timezone`` is persisted on the ``User`` record (single source of truth)
    rather than on ``PulseSettings``. Callers of this service can still pass
    ``timezone`` in ``PulseSettingsUpdate`` for backward compatibility with
    existing Pulse UI; the value is forwarded to ``User.timezone``.
    """
    settings = await get_settings(db, user_id)
    update_data = data.model_dump(exclude_unset=True)

    # Pop timezone and route it to the User record.
    new_timezone = update_data.pop("timezone", None)
    if new_timezone is not None:
        user_result = await db.execute(select(User).where(User.id == user_id))
        user = user_result.scalar_one_or_none()
        if user is not None:
            user.timezone = new_timezone

    reschedule_polling = "polling_interval_minutes" in update_data
    digest_fields = {"digest_schedule", "digest_time", "digest_day", "digest_interval_days"}
    reschedule_digest = (
        bool(digest_fields & update_data.keys()) or new_timezone is not None
    )
    reschedule_birthday = new_timezone is not None

    for key, value in update_data.items():
        setattr(settings, key, value)

    await db.flush()
    await db.refresh(settings)

    if reschedule_polling:
        schedule_user_polling(user_id, settings.polling_interval_minutes)

    # Resolve the timezone lazily — only when a scheduler call actually
    # needs it, to avoid an extra DB round trip on pure PS-only updates.
    if reschedule_digest or reschedule_birthday:
        current_tz = new_timezone or await _get_user_timezone(db, user_id)

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
                timezone=current_tz or "UTC",
            )

        if reschedule_birthday:
            schedule_user_birthday_check(user_id, current_tz or "UTC")

    return settings
