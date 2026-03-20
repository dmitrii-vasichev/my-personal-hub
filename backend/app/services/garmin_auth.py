import logging
from datetime import datetime, timezone

from fastapi import HTTPException, status
from garminconnect import GarminConnectTooManyRequestsError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.encryption import decrypt_value, encrypt_value
from app.models.garmin import GarminConnection

logger = logging.getLogger(__name__)

ALLOWED_SYNC_INTERVALS = {60, 120, 240, 360, 720, 1440}
RATE_LIMIT_MSG = (
    "Garmin rate limit exceeded (HTTP 429). "
    "Please wait approximately 1 hour before trying again."
)


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
    except GarminConnectTooManyRequestsError:
        conn.sync_status = "error"
        conn.sync_error = RATE_LIMIT_MSG
        await db.flush()
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=RATE_LIMIT_MSG,
        )
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
        }
    return {
        "connected": True,
        "last_sync_at": conn.last_sync_at,
        "sync_status": conn.sync_status,
        "sync_error": conn.sync_error,
        "sync_interval_minutes": conn.sync_interval_minutes,
        "connected_at": conn.connected_at,
    }


async def get_garmin_client(db: AsyncSession, user_id: int):
    """Get an authenticated Garmin client from stored tokens.

    Strategy: load cached Garth tokens and return the client directly.
    Garth handles automatic token refresh on API calls.
    Only fall back to credential-based login if tokens are invalid.
    """
    from garminconnect import Garmin, GarminConnectAuthenticationError

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

    # Validate tokens with a lightweight API call instead of login()
    try:
        client.get_user_profile()
    except GarminConnectTooManyRequestsError:
        logger.warning("Garmin rate limited for user %s, using cached tokens as-is", user_id)
        # Return client anyway — tokens may still work for subsequent calls
        return client
    except (GarminConnectAuthenticationError, Exception) as e:
        # Tokens expired/invalid — try re-login with stored credentials
        logger.info("Garmin tokens invalid for user %s, attempting re-login: %s", user_id, e)
        if not conn.email_encrypted or not conn.password_encrypted:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Garmin tokens expired and no credentials stored for re-login",
            )
        try:
            email = decrypt_value(conn.email_encrypted)
            password = decrypt_value(conn.password_encrypted)
            client = Garmin(email, password)
            client.login()
        except GarminConnectTooManyRequestsError:
            conn.sync_status = "error"
            conn.sync_error = RATE_LIMIT_MSG
            await db.flush()
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=RATE_LIMIT_MSG,
            )
        except Exception as login_err:
            conn.sync_status = "error"
            conn.sync_error = str(login_err)
            await db.flush()
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Garmin re-login failed: {login_err}",
            )

    # Re-serialize tokens (may have been refreshed)
    updated_tokens = client.garth.dumps()
    conn.garth_tokens_encrypted = encrypt_value(updated_tokens)
    await db.flush()

    return client


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
