"""Telegram authorization service using Telethon with encrypted session storage."""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from telethon import TelegramClient
from telethon.errors import (
    PhoneCodeInvalidError,
    SessionPasswordNeededError,
)
from telethon.sessions import StringSession

from app.core.config import settings
from app.core.encryption import decrypt_value, encrypt_value
from app.models.telegram import TelegramSession
from app.models.user import User

logger = logging.getLogger(__name__)

# In-memory store for pending auth flows (user_id -> TelegramClient).
# Short-lived: created at start_auth, consumed at verify_code.
_pending_clients: dict[int, TelegramClient] = {}


def is_configured() -> bool:
    """Check if Telegram API credentials are set."""
    return bool(settings.TELEGRAM_API_ID) and bool(settings.TELEGRAM_API_HASH)


def _create_client(session: str = "") -> TelegramClient:
    """Create a Telethon client with app credentials."""
    if not is_configured():
        raise ValueError(
            "Telegram API credentials not configured. "
            "Set TELEGRAM_API_ID and TELEGRAM_API_HASH in your .env file."
        )
    return TelegramClient(
        StringSession(session),
        settings.TELEGRAM_API_ID,
        settings.TELEGRAM_API_HASH,
    )


async def start_auth(db: AsyncSession, user: User, phone_number: str) -> dict:
    """Start Telegram authorization: send verification code to phone."""
    client = _create_client()
    await client.connect()

    result = await client.send_code_request(phone_number)

    # Store client in memory for verify_code step
    _pending_clients[user.id] = client

    return {
        "phone_code_hash": result.phone_code_hash,
        "phone_number": phone_number,
    }


async def verify_code(
    db: AsyncSession, user: User, code: str, password: str | None = None
) -> dict:
    """Complete Telegram authorization with verification code (and optional 2FA)."""
    client = _pending_clients.get(user.id)
    if client is None:
        raise ValueError("No pending auth session. Call start_auth first.")

    try:
        try:
            await client.sign_in(code=code)
        except SessionPasswordNeededError:
            if not password:
                raise ValueError("Two-factor authentication password required.")
            await client.sign_in(password=password)

        # Save encrypted session to DB
        session_string = client.session.save()
        encrypted_session = encrypt_value(session_string)
        encrypted_phone = encrypt_value(
            _pending_clients[user.id]._phone
            if hasattr(_pending_clients[user.id], "_phone")
            else ""
        )

        # Upsert: replace existing session for this user
        result = await db.execute(
            select(TelegramSession).where(TelegramSession.user_id == user.id)
        )
        existing = result.scalar_one_or_none()

        now = datetime.now(timezone.utc)
        if existing:
            existing.session_string = encrypted_session
            existing.phone_number = encrypted_phone
            existing.is_active = True
            existing.connected_at = now
            existing.last_used_at = now
        else:
            session_row = TelegramSession(
                user_id=user.id,
                session_string=encrypted_session,
                phone_number=encrypted_phone,
                is_active=True,
                connected_at=now,
                last_used_at=now,
            )
            db.add(session_row)

        await db.commit()

        return {"connected": True, "connected_at": now}

    except PhoneCodeInvalidError:
        raise ValueError("Invalid verification code.")
    finally:
        # Clean up pending client
        _pending_clients.pop(user.id, None)


async def get_status(db: AsyncSession, user: User) -> dict:
    """Return Telegram connection status for user."""
    result = await db.execute(
        select(TelegramSession).where(
            TelegramSession.user_id == user.id,
            TelegramSession.is_active.is_(True),
        )
    )
    session = result.scalar_one_or_none()

    if session is None:
        return {"connected": False, "phone_number": None, "connected_at": None}

    # Decrypt and mask phone number (show last 4 digits)
    try:
        phone = decrypt_value(session.phone_number)
        masked = f"***{phone[-4:]}" if phone and len(phone) >= 4 else "***"
    except (ValueError, Exception):
        masked = "***"

    return {
        "connected": True,
        "phone_number": masked,
        "connected_at": session.connected_at,
    }


async def disconnect(db: AsyncSession, user: User) -> None:
    """Disconnect Telegram: delete session from DB."""
    result = await db.execute(
        select(TelegramSession).where(TelegramSession.user_id == user.id)
    )
    session = result.scalar_one_or_none()

    if session:
        # Try to log out from Telegram
        try:
            client = _create_client(decrypt_value(session.session_string))
            await client.connect()
            await client.log_out()
        except Exception:
            logger.warning("Failed to log out Telegram session for user %s", user.id)

        await db.delete(session)
        await db.commit()


async def get_client_for_user(db: AsyncSession, user: User) -> TelegramClient | None:
    """Reconstruct TelegramClient from encrypted session (for later phases)."""
    result = await db.execute(
        select(TelegramSession).where(
            TelegramSession.user_id == user.id,
            TelegramSession.is_active.is_(True),
        )
    )
    session = result.scalar_one_or_none()

    if session is None:
        return None

    session_string = decrypt_value(session.session_string)
    client = _create_client(session_string)
    await client.connect()

    # Update last_used_at
    session.last_used_at = datetime.now(timezone.utc)
    await db.commit()

    return client
