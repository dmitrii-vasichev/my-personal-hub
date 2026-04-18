from __future__ import annotations

import secrets
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password, verify_password
from app.models.api_token import ApiToken
from app.models.user import User

RAW_TOKEN_PREFIX = "phub_"
RAW_TOKEN_BYTES = 30  # ~40 URL-safe chars after encoding
PREFIX_LENGTH = 12  # stored prefix incl. "phub_"


def _generate_raw_token() -> str:
    return RAW_TOKEN_PREFIX + secrets.token_urlsafe(RAW_TOKEN_BYTES)


async def create_token(
    db: AsyncSession, user: User, name: str
) -> tuple[ApiToken, str]:
    """Create a token for the user. Returns (ORM row, raw token shown once).

    Raises ``ValueError('duplicate')`` if (user_id, name) collides.
    """
    raw = _generate_raw_token()
    token = ApiToken(
        user_id=user.id,
        name=name,
        token_hash=hash_password(raw),
        token_prefix=raw[:PREFIX_LENGTH],
    )
    db.add(token)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise ValueError("duplicate")
    await db.refresh(token)
    return token, raw


async def list_tokens(db: AsyncSession, user: User) -> list[ApiToken]:
    result = await db.execute(
        select(ApiToken)
        .where(ApiToken.user_id == user.id, ApiToken.revoked_at.is_(None))
        .order_by(ApiToken.created_at.desc())
    )
    return list(result.scalars().all())


async def revoke_token(db: AsyncSession, user: User, token_id: int) -> bool:
    result = await db.execute(
        select(ApiToken).where(
            ApiToken.id == token_id,
            ApiToken.user_id == user.id,
            ApiToken.revoked_at.is_(None),
        )
    )
    token = result.scalar_one_or_none()
    if token is None:
        return False
    token.revoked_at = datetime.now(timezone.utc)
    await db.commit()
    return True


async def resolve_token(db: AsyncSession, raw: str) -> User | None:
    """Match a raw bearer token against stored hashes. None if no match."""
    if not raw.startswith(RAW_TOKEN_PREFIX):
        return None
    prefix = raw[:PREFIX_LENGTH]
    result = await db.execute(
        select(ApiToken).where(
            ApiToken.token_prefix == prefix,
            ApiToken.revoked_at.is_(None),
        )
    )
    candidates = list(result.scalars().all())
    for token in candidates:
        if verify_password(raw, token.token_hash):
            token.last_used_at = datetime.now(timezone.utc)
            await db.commit()
            user_result = await db.execute(
                select(User).where(User.id == token.user_id)
            )
            user = user_result.scalar_one_or_none()
            return user
    return None
