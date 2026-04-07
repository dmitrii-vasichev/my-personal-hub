"""Telegram Mini App authentication — validate initData and issue JWT."""

from __future__ import annotations

import hashlib
import hmac
import json
import time
from urllib.parse import parse_qs

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.encryption import decrypt_value
from app.core.security import create_access_token
from app.models.telegram import PulseSettings
from app.models.user import User


class MiniAppAuthError(Exception):
    pass


def validate_init_data(
    init_data: str, bot_token: str, max_age_seconds: int = 86400
) -> dict:
    """Validate Telegram Mini App initData hash per official docs.

    Returns parsed user dict from the ``user`` field.
    Raises MiniAppAuthError on any validation failure.
    """
    parsed = parse_qs(init_data)

    received_hash = parsed.get("hash", [None])[0]
    if not received_hash:
        raise MiniAppAuthError("Missing hash in initData")

    # Build data-check-string: sorted key=value pairs, excluding hash
    pairs = []
    for key, values in parsed.items():
        if key == "hash":
            continue
        pairs.append(f"{key}={values[0]}")
    pairs.sort()
    data_check_string = "\n".join(pairs)

    # HMAC-SHA256 validation
    secret_key = hmac.new(
        b"WebAppData", bot_token.encode(), hashlib.sha256
    ).digest()
    computed_hash = hmac.new(
        secret_key, data_check_string.encode(), hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(computed_hash, received_hash):
        raise MiniAppAuthError("Invalid initData signature")

    # Check freshness
    auth_date_str = parsed.get("auth_date", [None])[0]
    if auth_date_str:
        if time.time() - int(auth_date_str) > max_age_seconds:
            raise MiniAppAuthError("initData expired")

    # Extract user object
    user_data_str = parsed.get("user", [None])[0]
    if not user_data_str:
        raise MiniAppAuthError("Missing user in initData")

    return json.loads(user_data_str)


async def authenticate_miniapp_user(
    db: AsyncSession, init_data: str
) -> tuple[User, str]:
    """Validate Mini App initData, find Hub user, return (user, jwt_token).

    Raises MiniAppAuthError if validation fails or user is not linked.
    """
    # Resolve bot token: env var first, then from DB
    bot_token = settings.TELEGRAM_BOT_TOKEN
    if not bot_token:
        ps_row = await db.execute(
            select(PulseSettings).where(PulseSettings.bot_token.isnot(None)).limit(1)
        )
        ps_for_token = ps_row.scalar_one_or_none()
        if ps_for_token and ps_for_token.bot_token:
            bot_token = decrypt_value(ps_for_token.bot_token)
    if not bot_token:
        raise MiniAppAuthError("Bot token not configured")

    tg_user = validate_init_data(init_data, bot_token)
    telegram_id = tg_user.get("id")
    if not telegram_id:
        raise MiniAppAuthError("Missing Telegram user ID")

    # Match by PulseSettings.bot_chat_id (== Telegram user ID in private chats)
    result = await db.execute(
        select(PulseSettings).where(PulseSettings.bot_chat_id == telegram_id)
    )
    ps = result.scalar_one_or_none()
    if not ps:
        raise MiniAppAuthError("Telegram account not linked to any Hub user")

    user_result = await db.execute(select(User).where(User.id == ps.user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise MiniAppAuthError("Hub user not found")
    if user.is_blocked:
        raise MiniAppAuthError("Account is blocked")

    token = create_access_token(user.id, user.role.value)
    return user, token
