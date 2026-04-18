"""User-timezone-aware date/time helpers.

The user's timezone is stored on ``users.timezone`` (IANA name, default UTC).
All plain-date fields (applied_date, next_action_date, etc.) should use
``user_today()`` instead of ``date.today()`` so dates match the user's local
day. Prior to Phase 1 the timezone lived on ``pulse_settings.timezone``; it
has been consolidated onto the user for single source of truth.
"""

from __future__ import annotations

from datetime import date, datetime
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

DEFAULT_TZ = "UTC"


async def get_user_tz(db: AsyncSession, user_id: int) -> ZoneInfo:
    """Resolve the user's timezone from the User record, with UTC fallback."""
    from app.models.user import User

    result = await db.execute(
        select(User.timezone).where(User.id == user_id)
    )
    tz_name = result.scalar() or DEFAULT_TZ
    try:
        return ZoneInfo(tz_name)
    except Exception:
        return ZoneInfo(DEFAULT_TZ)


async def user_today(db: AsyncSession, user_id: int) -> date:
    """Get today's date in the user's local timezone."""
    tz = await get_user_tz(db, user_id)
    return datetime.now(tz).date()
