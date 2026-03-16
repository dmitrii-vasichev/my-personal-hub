"""Service for managing Pulse sources (Telegram channels/groups)."""
from __future__ import annotations

import logging

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.telegram import PulseSource
from app.models.user import User
from app.schemas.pulse_source import PulseSourceCreate, PulseSourceUpdate
from app.services.telegram_auth import get_client_for_user

logger = logging.getLogger(__name__)


async def list_sources(db: AsyncSession, user_id: int) -> list[PulseSource]:
    result = await db.execute(
        select(PulseSource)
        .where(PulseSource.user_id == user_id)
        .order_by(PulseSource.category, PulseSource.title)
    )
    return list(result.scalars().all())


async def get_source(db: AsyncSession, source_id: int, user_id: int) -> PulseSource:
    result = await db.execute(
        select(PulseSource).where(
            PulseSource.id == source_id,
            PulseSource.user_id == user_id,
        )
    )
    source = result.scalar_one_or_none()
    if source is None:
        raise HTTPException(status_code=404, detail="Source not found")
    return source


async def create_source(
    db: AsyncSession, user_id: int, data: PulseSourceCreate
) -> PulseSource:
    # Check unique (user_id, telegram_id)
    existing = await db.execute(
        select(PulseSource).where(
            PulseSource.user_id == user_id,
            PulseSource.telegram_id == data.telegram_id,
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=409, detail="Source with this Telegram ID already exists"
        )

    source = PulseSource(
        user_id=user_id,
        telegram_id=data.telegram_id,
        username=data.username,
        title=data.title,
        category=data.category,
        subcategory=data.subcategory,
        keywords=data.keywords,
        criteria=data.criteria,
    )
    db.add(source)
    await db.flush()
    await db.refresh(source)
    return source


async def update_source(
    db: AsyncSession, source_id: int, user_id: int, data: PulseSourceUpdate
) -> PulseSource:
    source = await get_source(db, source_id, user_id)
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(source, key, value)
    await db.flush()
    await db.refresh(source)
    return source


async def delete_source(db: AsyncSession, source_id: int, user_id: int) -> None:
    source = await get_source(db, source_id, user_id)
    await db.delete(source)
    await db.flush()


async def resolve_source(db: AsyncSession, user: User, identifier: str) -> dict:
    """Resolve a Telegram channel/group by username or invite link."""
    client = await get_client_for_user(db, user)
    if client is None:
        raise HTTPException(
            status_code=400, detail="Telegram not connected. Connect first in Settings."
        )

    try:
        entity = await client.get_entity(identifier)
        return {
            "telegram_id": entity.id,
            "username": getattr(entity, "username", None),
            "title": getattr(entity, "title", str(entity.id)),
            "members_count": getattr(entity, "participants_count", None),
        }
    except Exception as e:
        logger.warning("Failed to resolve %s: %s", identifier, e)
        raise HTTPException(status_code=404, detail=f"Could not resolve: {identifier}")
    finally:
        await client.disconnect()
