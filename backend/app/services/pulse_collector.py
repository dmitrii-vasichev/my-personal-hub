"""Message collection service — polls Telegram sources via Telethon."""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.telegram import PulseMessage, PulseSettings, PulseSource
from app.models.user import User
from app.services.pulse_filter import keyword_filter
from app.services.telegram_auth import get_client_for_user

logger = logging.getLogger(__name__)


async def collect_source(
    db: AsyncSession,
    user: User,
    source: PulseSource,
    ttl_days: int = 30,
    message_limit: int = 100,
) -> int:
    """Collect new messages from a single source. Returns count of new messages stored."""
    client = await get_client_for_user(db, user)
    if client is None:
        logger.warning("No Telegram client for user %s, skipping source %s", user.id, source.id)
        return 0

    try:
        entity = await client.get_entity(source.telegram_id)

        # Determine offset: last polled time or 24h ago for first poll
        offset_date = source.last_polled_at or (datetime.now(timezone.utc) - timedelta(hours=24))

        stored = 0
        async for message in client.iter_messages(entity, offset_date=offset_date, limit=message_limit):
            if not message.text:
                continue

            # Apply keyword filter
            if not keyword_filter(message.text, source.keywords):
                continue

            # Deduplication check
            existing = await db.execute(
                select(PulseMessage.id).where(
                    PulseMessage.user_id == user.id,
                    PulseMessage.source_id == source.id,
                    PulseMessage.telegram_message_id == message.id,
                )
            )
            if existing.scalar_one_or_none() is not None:
                continue

            now = datetime.now(timezone.utc)
            pulse_msg = PulseMessage(
                user_id=user.id,
                source_id=source.id,
                telegram_message_id=message.id,
                text=message.text,
                sender_name=getattr(message.sender, "first_name", None) if message.sender else None,
                message_date=message.date,
                category=source.category,
                status="new",
                collected_at=now,
                expires_at=now + timedelta(days=ttl_days),
            )
            db.add(pulse_msg)
            stored += 1

        # Update last polled timestamp
        source.last_polled_at = datetime.now(timezone.utc)
        await db.flush()

        logger.info(
            "Source '%s' (id=%s): %d new messages stored",
            source.title, source.id, stored,
        )
        return stored

    except Exception as e:
        logger.error("Failed to collect source '%s' (id=%s): %s", source.title, source.id, e)
        return 0
    finally:
        await client.disconnect()


async def collect_all_sources(db: AsyncSession, user: User) -> dict:
    """Collect messages from all active sources for a user.

    Returns summary: {sources_polled, messages_collected}.
    """
    result = await db.execute(
        select(PulseSource).where(
            PulseSource.user_id == user.id,
            PulseSource.is_active.is_(True),
        )
    )
    sources = list(result.scalars().all())

    # Get TTL from settings
    settings_result = await db.execute(
        select(PulseSettings).where(PulseSettings.user_id == user.id)
    )
    pulse_settings = settings_result.scalar_one_or_none()
    ttl_days = pulse_settings.message_ttl_days if pulse_settings else 30
    message_limit = pulse_settings.poll_message_limit if pulse_settings else 100

    total_messages = 0
    for source in sources:
        count = await collect_source(db, user, source, ttl_days, message_limit)
        total_messages += count
        # Delay between sources to avoid rate limits
        if source != sources[-1]:
            await asyncio.sleep(2)

    await db.commit()
    logger.info(
        "User %s: polled %d sources, collected %d messages",
        user.id, len(sources), total_messages,
    )
    return {"sources_polled": len(sources), "messages_collected": total_messages}
