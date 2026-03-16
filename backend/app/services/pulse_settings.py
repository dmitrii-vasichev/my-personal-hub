"""Service for managing Pulse settings."""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.scheduler import schedule_user_polling
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

    reschedule = "polling_interval_minutes" in update_data

    for key, value in update_data.items():
        setattr(settings, key, value)

    await db.flush()
    await db.refresh(settings)

    if reschedule:
        schedule_user_polling(user_id, settings.polling_interval_minutes)

    return settings
