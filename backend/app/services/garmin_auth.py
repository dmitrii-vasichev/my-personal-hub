import logging
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from garminconnect import GarminConnectTooManyRequestsError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.encryption import decrypt_value, encrypt_value
from app.models.garmin import GarminConnection

logger = logging.getLogger(__name__)

ALLOWED_SYNC_INTERVALS = {60, 120, 240, 360, 720, 1440}
BACKOFF_BASE_MINUTES = 15
BACKOFF_CAP_MINUTES = 120
RATE_LIMIT_MSG = (
    "Garmin rate limit exceeded (HTTP 429). "
    "Sync will retry automatically with increasing delay."
)


def calculate_backoff_minutes(consecutive_failures: int) -> int:
    """Calculate exponential backoff: 15 → 30 → 60 → 120 (cap) minutes."""
    return min(BACKOFF_BASE_MINUTES * (2 ** consecutive_failures), BACKOFF_CAP_MINUTES)


class GarminRateLimitError(Exception):
    """Raised when a Garmin API call returns 429 (rate limited)."""


async def connect(
    db: AsyncSession, user_id: int, email: str, password: str
) -> GarminConnection:
    """Connect Garmin account: encrypt credentials, attempt login, store tokens."""
    from garminconnect import Garmin

    email_enc = encrypt_value(email)
    password_enc = encrypt_value(password)

    # Upsert: update if exists, create if not
    result = await db.execute(
        select(GarminConnection).where(GarminConnection.user_id == user_id)
    )
    conn = result.scalar_one_or_none()

    if conn is None:
        conn = GarminConnection(
            user_id=user_id,
            email_encrypted=email_enc,
            password_encrypted=password_enc,
            sync_interval_minutes=240,
        )
        db.add(conn)
    else:
        conn.email_encrypted = email_enc
        conn.password_encrypted = password_enc
        conn.sync_error = None

    # Check rate-limit cooldown before hitting Garmin API
    if conn.rate_limited_until and conn.rate_limited_until > datetime.now(timezone.utc):
        raise GarminRateLimitError(RATE_LIMIT_MSG)

    # Attempt Garmin login
    try:
        client = Garmin(email, password)
        client.login()
        # Serialize Garth tokens
        tokens_data = client.garth.dumps()
        conn.garth_tokens_encrypted = encrypt_value(tokens_data)
        conn.sync_status = "success"
        conn.connected_at = datetime.now(timezone.utc)
        conn.is_active = True
        conn.rate_limited_until = None
        conn.consecutive_failures = 0
    except GarminConnectTooManyRequestsError:
        failures = (conn.consecutive_failures or 0) + 1
        conn.consecutive_failures = failures
        cooldown = calculate_backoff_minutes(failures - 1)
        conn.rate_limited_until = datetime.now(timezone.utc) + timedelta(minutes=cooldown)
        conn.sync_status = "error"
        conn.sync_error = RATE_LIMIT_MSG
        # Don't mark as active if login never succeeded (no tokens)
        if not conn.garth_tokens_encrypted:
            conn.is_active = False
        await db.flush()
        raise GarminRateLimitError(RATE_LIMIT_MSG)
    except Exception as e:
        conn.sync_status = "error"
        conn.sync_error = str(e)
        await db.flush()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Garmin login failed: {e}",
        )

    await db.flush()

    # Schedule periodic sync
    from app.core.scheduler import schedule_garmin_sync

    schedule_garmin_sync(user_id, conn.sync_interval_minutes)

    return conn


async def disconnect(db: AsyncSession, user_id: int) -> None:
    """Disconnect Garmin: delete connection record but keep historical data."""
    from app.core.scheduler import remove_garmin_sync

    result = await db.execute(
        select(GarminConnection).where(GarminConnection.user_id == user_id)
    )
    conn = result.scalar_one_or_none()
    if conn is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No Garmin connection found",
        )

    remove_garmin_sync(user_id)
    await db.delete(conn)
    await db.flush()


async def get_status(db: AsyncSession, user_id: int) -> dict:
    """Get Garmin connection status for user."""
    result = await db.execute(
        select(GarminConnection).where(GarminConnection.user_id == user_id)
    )
    conn = result.scalar_one_or_none()
    if conn is None:
        return {
            "connected": False,
            "last_sync_at": None,
            "sync_status": None,
            "sync_error": None,
            "sync_interval_minutes": None,
            "connected_at": None,
            "rate_limited_until": None,
        }

    # Auto-clear stale rate-limit state when cooldown has expired
    rate_limited_until = conn.rate_limited_until
    sync_error = conn.sync_error
    if rate_limited_until and rate_limited_until <= datetime.now(timezone.utc):
        rate_limited_until = None
        # Clear the stale 429 error so the UI doesn't show it after cooldown
        if sync_error == RATE_LIMIT_MSG:
            sync_error = None

    return {
        "connected": conn.is_active,
        "last_sync_at": conn.last_sync_at,
        "sync_status": conn.sync_status,
        "sync_error": sync_error,
        "sync_interval_minutes": conn.sync_interval_minutes,
        "connected_at": conn.connected_at,
        "rate_limited_until": rate_limited_until,
    }


async def get_garmin_client(db: AsyncSession, user_id: int):
    """Get an authenticated Garmin client from stored tokens.

    Strategy: load cached Garth tokens and return the client directly.
    Garth handles automatic token refresh transparently on API calls.
    No validation call is made — this avoids wasting API quota.
    """
    from garminconnect import Garmin

    result = await db.execute(
        select(GarminConnection).where(GarminConnection.user_id == user_id)
    )
    conn = result.scalar_one_or_none()
    if conn is None or not conn.garth_tokens_encrypted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No Garmin connection found or no tokens stored",
        )

    tokens_data = decrypt_value(conn.garth_tokens_encrypted)
    client = Garmin()
    client.garth.loads(tokens_data)

    return client


async def set_rate_limited(db: AsyncSession, user_id: int) -> None:
    """Set rate_limited_until cooldown with exponential backoff after a 429 response."""
    result = await db.execute(
        select(GarminConnection).where(GarminConnection.user_id == user_id)
    )
    conn = result.scalar_one_or_none()
    if conn is None:
        return
    failures = (conn.consecutive_failures or 0) + 1
    conn.consecutive_failures = failures
    cooldown = calculate_backoff_minutes(failures - 1)
    conn.rate_limited_until = datetime.now(timezone.utc) + timedelta(minutes=cooldown)
    conn.sync_status = "error"
    conn.sync_error = RATE_LIMIT_MSG
    await db.flush()


async def update_sync_interval(
    db: AsyncSession, user_id: int, interval_minutes: int
) -> GarminConnection:
    """Update sync interval for Garmin connection."""
    if interval_minutes not in ALLOWED_SYNC_INTERVALS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid interval. Allowed: {sorted(ALLOWED_SYNC_INTERVALS)}",
        )

    result = await db.execute(
        select(GarminConnection).where(GarminConnection.user_id == user_id)
    )
    conn = result.scalar_one_or_none()
    if conn is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No Garmin connection found",
        )

    conn.sync_interval_minutes = interval_minutes
    await db.flush()

    # Reschedule sync job with new interval
    from app.core.scheduler import schedule_garmin_sync

    schedule_garmin_sync(user_id, interval_minutes)

    return conn
