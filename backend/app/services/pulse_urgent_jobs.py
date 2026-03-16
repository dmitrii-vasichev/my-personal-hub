"""Detect urgent high-relevance job messages for notification."""
from __future__ import annotations

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.telegram import PulseMessage

URGENT_RELEVANCE_THRESHOLD = 0.8


async def check_urgent_jobs(db: AsyncSession, user_id: int) -> list[PulseMessage]:
    """Find new high-relevance job messages that haven't been notified yet.

    Returns the list of urgent messages and marks them as notified_urgent=True.
    """
    result = await db.execute(
        select(PulseMessage).where(
            and_(
                PulseMessage.user_id == user_id,
                PulseMessage.category == "jobs",
                PulseMessage.status == "new",
                PulseMessage.ai_relevance >= URGENT_RELEVANCE_THRESHOLD,
                PulseMessage.notified_urgent.is_(False),
            )
        )
    )
    messages = list(result.scalars().all())

    for msg in messages:
        msg.notified_urgent = True

    return messages
