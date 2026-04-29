"""Learning inbox service for Pulse.

Provides inbox item listing, single/bulk action routing (→ Action, → Note, skip).
"""
from __future__ import annotations

import logging
from typing import Optional

from google.oauth2.credentials import Credentials
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.telegram import PulseMessage, PulseSource
from app.models.user import User
from app.schemas.pulse_inbox import InboxAction, InboxItemResponse
from app.services import actions as action_service
from app.services import note as note_service

logger = logging.getLogger(__name__)

# Statuses that appear in the inbox
INBOX_STATUSES = ("new", "in_digest")


async def get_inbox_items(
    db: AsyncSession,
    user_id: int,
    classification: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[InboxItemResponse], int]:
    """Get learning inbox items — messages with category='learning' and ai_classification set.

    Returns (items, total_count).
    """
    base = (
        select(PulseMessage)
        .where(
            PulseMessage.user_id == user_id,
            PulseMessage.category == "learning",
            PulseMessage.ai_classification.isnot(None),
            PulseMessage.status.in_(INBOX_STATUSES),
        )
    )
    if classification:
        base = base.where(PulseMessage.ai_classification == classification)

    # Total count
    count_q = select(func.count()).select_from(base.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    # Fetch items with source info
    query = (
        base
        .order_by(PulseMessage.message_date.desc())
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(query)
    messages = list(result.scalars().all())

    # Load source titles
    source_ids = {m.source_id for m in messages}
    source_titles: dict[int, str] = {}
    if source_ids:
        sources_result = await db.execute(
            select(PulseSource.id, PulseSource.title).where(PulseSource.id.in_(source_ids))
        )
        source_titles = {row.id: row.title for row in sources_result.all()}

    items = [
        InboxItemResponse(
            id=m.id,
            text=m.text,
            sender_name=m.sender_name,
            message_date=m.message_date,
            source_title=source_titles.get(m.source_id),
            source_id=m.source_id,
            ai_classification=m.ai_classification,
            ai_relevance=m.ai_relevance,
            status=m.status,
            collected_at=m.collected_at,
        )
        for m in messages
    ]

    return items, total


async def process_action(
    db: AsyncSession,
    user: User,
    message_id: int,
    action: InboxAction,
    credentials: Optional[Credentials] = None,
    folder_id: Optional[str] = None,
) -> bool:
    """Process a single inbox item action.

    Returns True on success, False if message not found or not owned.
    """
    result = await db.execute(
        select(PulseMessage).where(
            PulseMessage.id == message_id,
            PulseMessage.user_id == user.id,
        )
    )
    message = result.scalar_one_or_none()
    if not message:
        return False

    if action == InboxAction.to_action:
        title = _extract_title(message.text)
        description = message.text or ""
        await action_service.create_action(
            db,
            title=f"[Pulse] {title}",
            details=description,
            user=user,
        )
        message.status = "actioned"

    elif action == InboxAction.to_note:
        if not credentials or not folder_id:
            raise ValueError("Google credentials and folder_id required for to_note action")
        title = _extract_title(message.text)
        content = message.text or ""
        await note_service.create_note(
            db, user, f"Pulse: {title}", content, credentials, folder_id
        )
        message.status = "actioned"

    elif action == InboxAction.skip:
        message.status = "skipped"

    await db.commit()
    logger.info("Inbox action %s on message %s for user %s", action.value, message_id, user.id)
    return True


async def bulk_action(
    db: AsyncSession,
    user: User,
    message_ids: list[int],
    action: InboxAction,
    credentials: Optional[Credentials] = None,
    folder_id: Optional[str] = None,
) -> int:
    """Process bulk action on multiple inbox items.

    Returns count of successfully processed items.
    """
    count = 0
    for mid in message_ids:
        ok = await process_action(db, user, mid, action, credentials, folder_id)
        if ok:
            count += 1
    return count


def _extract_title(text: Optional[str], max_len: int = 80) -> str:
    """Extract a short title from message text."""
    if not text:
        return "Untitled"
    first_line = text.split("\n")[0].strip()
    if len(first_line) > max_len:
        return first_line[:max_len] + "..."
    return first_line or "Untitled"
