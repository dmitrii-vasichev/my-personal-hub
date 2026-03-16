"""Polling orchestrator and TTL cleanup jobs for APScheduler."""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session_factory
from app.core.encryption import decrypt_value
from app.models.telegram import PulseMessage, PulseSettings, PulseSource
from app.models.user import User
from app.models.settings import UserSettings
from app.services.ai import get_llm_client
from app.services.pulse_ai_filter import analyze_relevance
from app.services.pulse_collector import collect_all_sources
from app.services.telegram_notifications import (
    send_digest_notification,
    send_urgent_job_notification,
)

logger = logging.getLogger(__name__)


async def run_user_poll(user_id: int) -> None:
    """Scheduled job: poll all sources for a user, apply AI filter to results."""
    async with async_session_factory() as db:
        try:
            # Get user
            result = await db.execute(select(User).where(User.id == user_id))
            user = result.scalar_one_or_none()
            if user is None:
                logger.warning("User %s not found, skipping poll", user_id)
                return

            # Collect messages (keyword filter applied inside)
            summary = await collect_all_sources(db, user)

            # Apply AI relevance to new messages
            ai_count = await _apply_ai_filter(db, user_id)

            # Check and notify urgent jobs
            await _notify_urgent_jobs(db, user_id)

            logger.info(
                "Poll complete for user %s: %d sources, %d messages, %d AI-analyzed",
                user_id,
                summary["sources_polled"],
                summary["messages_collected"],
                ai_count,
            )

        except Exception as e:
            logger.error("Poll failed for user %s: %s", user_id, e)


async def _apply_ai_filter(db: AsyncSession, user_id: int) -> int:
    """Apply AI relevance filter to new messages that haven't been analyzed yet."""
    # Get user's LLM settings
    settings_result = await db.execute(
        select(UserSettings).where(UserSettings.user_id == user_id)
    )
    user_settings = settings_result.scalar_one_or_none()

    if not user_settings or not user_settings.llm_provider:
        return 0

    # Get the encrypted API key for the provider
    key_field = f"api_key_{user_settings.llm_provider}"
    encrypted_key = getattr(user_settings, key_field, None)
    if not encrypted_key:
        return 0

    try:
        api_key = decrypt_value(encrypted_key)
        llm_client = get_llm_client(user_settings.llm_provider, api_key)
    except Exception as e:
        logger.warning("Could not create LLM client for user %s: %s", user_id, e)
        return 0

    # Get unanalyzed messages (ai_relevance is None, not news category)
    result = await db.execute(
        select(PulseMessage)
        .where(
            PulseMessage.user_id == user_id,
            PulseMessage.ai_relevance.is_(None),
            PulseMessage.category.in_(["jobs", "learning"]),
        )
        .limit(50)
    )
    messages = list(result.scalars().all())

    # Get source criteria for jobs messages
    source_criteria = {}
    if messages:
        source_ids = {m.source_id for m in messages}
        sources_result = await db.execute(
            select(PulseSource).where(PulseSource.id.in_(source_ids))
        )
        for s in sources_result.scalars().all():
            source_criteria[s.id] = s.criteria

    count = 0
    for msg in messages:
        try:
            criteria = source_criteria.get(msg.source_id)
            relevance, classification = await analyze_relevance(
                msg.text or "", msg.category or "news", criteria, llm_client
            )
            msg.ai_relevance = relevance
            if classification:
                msg.ai_classification = classification
            count += 1
        except Exception as e:
            logger.warning("AI filter failed for message %s: %s", msg.id, e)

    await db.commit()
    return count


async def run_user_digest(user_id: int) -> None:
    """Scheduled job: generate digest for a user using their LLM settings."""
    async with async_session_factory() as db:
        try:
            # Check user exists
            result = await db.execute(select(User).where(User.id == user_id))
            user = result.scalar_one_or_none()
            if user is None:
                logger.warning("User %s not found, skipping digest", user_id)
                return

            # Get LLM client
            settings_result = await db.execute(
                select(UserSettings).where(UserSettings.user_id == user_id)
            )
            user_settings = settings_result.scalar_one_or_none()
            if not user_settings or not user_settings.llm_provider:
                logger.warning("No LLM provider for user %s, skipping digest", user_id)
                return

            key_field = f"api_key_{user_settings.llm_provider}"
            encrypted_key = getattr(user_settings, key_field, None)
            if not encrypted_key:
                logger.warning("No LLM API key for user %s, skipping digest", user_id)
                return

            api_key = decrypt_value(encrypted_key)
            llm_client = get_llm_client(user_settings.llm_provider, api_key)

            from app.services.pulse_digest import generate_digest

            digest = await generate_digest(db, user_id, llm_client)
            if digest:
                await db.commit()
                logger.info(
                    "Scheduled digest generated for user %s: %d messages",
                    user_id, digest.message_count,
                )

                # Send bot notification if enabled
                await _notify_digest_ready(db, user_id, digest)
            else:
                logger.info("No new messages for user %s digest", user_id)

        except Exception as e:
            logger.error("Digest generation failed for user %s: %s", user_id, e)


async def _notify_digest_ready(db: AsyncSession, user_id: int, digest) -> None:
    """Send bot notification when digest is ready (if enabled)."""
    try:
        ps_result = await db.execute(
            select(PulseSettings).where(PulseSettings.user_id == user_id)
        )
        ps = ps_result.scalar_one_or_none()
        if not ps or not ps.notify_digest_ready or not ps.bot_token or not ps.bot_chat_id:
            return

        token = decrypt_value(ps.bot_token)
        result = await send_digest_notification(token, ps.bot_chat_id, digest)
        if result["success"]:
            logger.info("Digest notification sent for user %s", user_id)
        else:
            logger.warning("Digest notification failed for user %s: %s", user_id, result["error"])
    except Exception as e:
        logger.warning("Digest notification error for user %s: %s", user_id, e)


async def _notify_urgent_jobs(db: AsyncSession, user_id: int) -> None:
    """Check for urgent jobs and send bot notifications (if enabled)."""
    try:
        ps_result = await db.execute(
            select(PulseSettings).where(PulseSettings.user_id == user_id)
        )
        ps = ps_result.scalar_one_or_none()
        if not ps or not ps.notify_urgent_jobs or not ps.bot_token or not ps.bot_chat_id:
            return

        from app.services.pulse_urgent_jobs import check_urgent_jobs

        urgent_messages = await check_urgent_jobs(db, user_id)
        if not urgent_messages:
            return

        token = decrypt_value(ps.bot_token)

        # Get source titles for messages
        source_ids = {m.source_id for m in urgent_messages}
        sources_result = await db.execute(
            select(PulseSource).where(PulseSource.id.in_(source_ids))
        )
        source_map = {s.id: s.title for s in sources_result.scalars().all()}

        for msg in urgent_messages:
            source_title = source_map.get(msg.source_id, "Unknown")
            await send_urgent_job_notification(token, ps.bot_chat_id, msg, source_title)

        await db.commit()
        logger.info("Sent %d urgent job notifications for user %s", len(urgent_messages), user_id)
    except Exception as e:
        logger.warning("Urgent job notification error for user %s: %s", user_id, e)


async def run_ttl_cleanup() -> None:
    """Scheduled job: delete expired messages."""
    async with async_session_factory() as db:
        try:
            now = datetime.now(timezone.utc)
            result = await db.execute(
                delete(PulseMessage).where(
                    PulseMessage.expires_at.isnot(None),
                    PulseMessage.expires_at < now,
                )
            )
            count = result.rowcount
            await db.commit()

            if count > 0:
                logger.info("TTL cleanup: deleted %d expired messages", count)

        except Exception as e:
            logger.error("TTL cleanup failed: %s", e)
