"""
Google OAuth2 service for Calendar integration.

Flow:
1. User calls GET /api/calendar/oauth/connect -> gets authorization URL
2. User visits URL, grants permissions, Google redirects to REDIRECT_URI with ?code=...
3. GET /api/calendar/oauth/callback?code=... exchanges code for tokens, stores encrypted
4. Subsequent calls use stored tokens; refresh automatically when expired
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.encryption import decrypt_value, encrypt_value
from app.models.calendar import GoogleOAuthToken
from app.models.user import User

SCOPES = ["https://www.googleapis.com/auth/calendar"]


def _build_flow(state: Optional[str] = None) -> Flow:
    client_config = {
        "web": {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "redirect_uris": [settings.GOOGLE_REDIRECT_URI],
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
        }
    }
    flow = Flow.from_client_config(
        client_config,
        scopes=SCOPES,
        redirect_uri=settings.GOOGLE_REDIRECT_URI,
        state=state,
    )
    return flow


def get_authorization_url(state: str) -> str:
    """Return Google OAuth2 authorization URL with given state."""
    flow = _build_flow()
    auth_url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
        state=state,
    )
    return auth_url


async def exchange_code_for_tokens(
    db: AsyncSession,
    code: str,
    user: User,
) -> GoogleOAuthToken:
    """Exchange authorization code for tokens and store encrypted."""
    flow = _build_flow()
    flow.fetch_token(code=code)
    creds = flow.credentials

    token_expiry = creds.expiry
    if token_expiry and token_expiry.tzinfo is None:
        token_expiry = token_expiry.replace(tzinfo=timezone.utc)

    # Check if token record already exists for user
    result = await db.execute(
        select(GoogleOAuthToken).where(GoogleOAuthToken.user_id == user.id)
    )
    token_record = result.scalar_one_or_none()

    encrypted_access = encrypt_value(creds.token)
    encrypted_refresh = encrypt_value(creds.refresh_token) if creds.refresh_token else encrypt_value("")

    if token_record:
        token_record.access_token = encrypted_access
        token_record.refresh_token = encrypted_refresh
        token_record.token_expiry = token_expiry
    else:
        token_record = GoogleOAuthToken(
            user_id=user.id,
            access_token=encrypted_access,
            refresh_token=encrypted_refresh,
            token_expiry=token_expiry,
        )
        db.add(token_record)

    await db.commit()
    await db.refresh(token_record)
    return token_record


async def get_credentials(
    db: AsyncSession,
    user: User,
) -> Optional[Credentials]:
    """Return valid Google credentials for user, refreshing if needed."""
    result = await db.execute(
        select(GoogleOAuthToken).where(GoogleOAuthToken.user_id == user.id)
    )
    token_record = result.scalar_one_or_none()
    if not token_record:
        return None

    try:
        access_token = decrypt_value(token_record.access_token)
        refresh_token = decrypt_value(token_record.refresh_token)
    except ValueError:
        return None

    creds = Credentials(
        token=access_token,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.GOOGLE_CLIENT_ID,
        client_secret=settings.GOOGLE_CLIENT_SECRET,
        scopes=SCOPES,
    )

    # Refresh if expired
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        # Update stored tokens
        new_expiry = creds.expiry
        if new_expiry and new_expiry.tzinfo is None:
            new_expiry = new_expiry.replace(tzinfo=timezone.utc)
        token_record.access_token = encrypt_value(creds.token)
        token_record.token_expiry = new_expiry
        await db.commit()

    return creds


async def disconnect(db: AsyncSession, user: User) -> bool:
    """Revoke tokens and delete from DB."""
    result = await db.execute(
        select(GoogleOAuthToken).where(GoogleOAuthToken.user_id == user.id)
    )
    token_record = result.scalar_one_or_none()
    if not token_record:
        return False

    # Attempt to revoke via Google (best-effort)
    try:
        creds = await get_credentials(db, user)
        if creds:
            import httpx
            await httpx.AsyncClient().post(
                "https://oauth2.googleapis.com/revoke",
                params={"token": creds.token},
            )
    except Exception:
        pass  # Revocation failure should not block disconnect

    await db.delete(token_record)
    await db.commit()
    return True


async def get_status(
    db: AsyncSession,
    user: User,
) -> dict:
    """Return OAuth connection status for user."""
    result = await db.execute(
        select(GoogleOAuthToken).where(GoogleOAuthToken.user_id == user.id)
    )
    token_record = result.scalar_one_or_none()
    if not token_record:
        return {"connected": False, "calendar_id": None, "last_synced": None}
    return {
        "connected": True,
        "calendar_id": token_record.calendar_id,
        "last_synced": None,  # Will be populated by sync service
    }
