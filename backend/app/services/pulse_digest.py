"""Digest generation service for Pulse.

Groups new messages by category/subcategory/source, builds prompts,
calls the user's LLM provider, and stores structured markdown summaries.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.telegram import PulseDigest, PulseMessage, PulseSource

if TYPE_CHECKING:
    from app.services.ai import LLMAdapter

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Prompt templates per category
# ---------------------------------------------------------------------------

NEWS_SYSTEM_PROMPT = """You are an expert news summarizer. Given a batch of messages from Telegram channels grouped by subcategory and source, produce a concise digest in Markdown.

Rules:
- Group by subcategory (use ## headers), then by source (use ### headers)
- For each group: summarize key events, highlight important news
- Keep each item to 1-2 sentences
- Use bullet points for individual items
- If multiple messages cover the same event, merge them
- Write in the same language as the original messages
- End with a "Key Takeaways" section (3-5 bullets max)"""

JOBS_SYSTEM_PROMPT = """You are a job market digest compiler. Given a batch of job-related messages from Telegram channels, produce a structured digest in Markdown.

Rules:
- Group by subcategory (use ## headers), then by source (use ### headers)
- For each job posting: include company, position title, key requirements, and any salary info
- Sort by relevance score (highest first) if available
- Highlight postings with relevance >= 0.8 with a ⭐ prefix
- Write in the same language as the original messages
- End with a brief "Market Summary" (2-3 sentences about trends you notice)"""

LEARNING_SYSTEM_PROMPT = """You are a learning content curator. Given a batch of educational/learning messages from Telegram channels, produce a structured digest in Markdown.

Rules:
- Group by classification type: Articles, Lifehacks, Insights, Tools, Other (use ## headers)
- Within each group, organize by source (use ### headers)
- For each item: brief description (1-2 sentences) and why it's valuable
- Highlight high-relevance items (>= 0.8) with a ⭐ prefix
- Write in the same language as the original messages
- End with "Top Picks" section (3-5 best items)"""

CATEGORY_PROMPTS = {
    "news": NEWS_SYSTEM_PROMPT,
    "jobs": JOBS_SYSTEM_PROMPT,
    "learning": LEARNING_SYSTEM_PROMPT,
}


def _build_user_prompt(
    messages: list[PulseMessage],
    sources_map: dict[int, PulseSource],
) -> str:
    """Build a structured user prompt from grouped messages."""
    # Group messages: subcategory -> source_id -> messages
    grouped: dict[str, dict[int, list[PulseMessage]]] = {}
    for msg in messages:
        sub = msg.category or "general"
        source_id = msg.source_id
        grouped.setdefault(sub, {}).setdefault(source_id, []).append(msg)

    parts: list[str] = []
    for subcategory, by_source in sorted(grouped.items()):
        parts.append(f"\n=== Subcategory: {subcategory} ===")
        for source_id, msgs in by_source.items():
            source = sources_map.get(source_id)
            source_title = source.title if source else f"Source #{source_id}"
            parts.append(f"\n--- Source: {source_title} ---")
            for msg in msgs:
                relevance_tag = ""
                if msg.ai_relevance is not None:
                    relevance_tag = f" [relevance: {msg.ai_relevance:.1f}]"
                classification_tag = ""
                if msg.ai_classification:
                    classification_tag = f" [type: {msg.ai_classification}]"

                date_str = ""
                if msg.message_date:
                    date_str = msg.message_date.strftime(" (%Y-%m-%d %H:%M)")

                text = (msg.text or "")[:3000]
                parts.append(f"• {text}{date_str}{relevance_tag}{classification_tag}")

    return "\n".join(parts)


async def generate_digest(
    db: AsyncSession,
    user_id: int,
    llm_client: "LLMAdapter",
    category: str | None = None,
) -> PulseDigest | None:
    """Generate a digest from new messages.

    Args:
        db: Database session.
        user_id: Owner user ID.
        llm_client: Configured LLM adapter.
        category: Optional category filter (news/jobs/learning). None = all.

    Returns:
        Created PulseDigest or None if no new messages.

    Raises:
        RuntimeError: If LLM call fails.
    """
    # Query new messages
    query = (
        select(PulseMessage)
        .where(
            PulseMessage.user_id == user_id,
            PulseMessage.status == "new",
        )
        .order_by(PulseMessage.message_date.asc())
    )
    if category:
        query = query.where(PulseMessage.category == category)

    result = await db.execute(query)
    messages = list(result.scalars().all())

    if not messages:
        return None

    # Load sources for context
    source_ids = {m.source_id for m in messages}
    sources_result = await db.execute(
        select(PulseSource).where(PulseSource.id.in_(source_ids))
    )
    sources_map = {s.id: s for s in sources_result.scalars().all()}

    # Determine effective category for prompt selection
    categories_in_messages = {m.category for m in messages if m.category}
    if category:
        effective_category = category
    elif len(categories_in_messages) == 1:
        effective_category = categories_in_messages.pop()
    else:
        effective_category = "news"  # default for mixed

    system_prompt = CATEGORY_PROMPTS.get(effective_category, NEWS_SYSTEM_PROMPT)
    user_prompt = _build_user_prompt(messages, sources_map)

    # Calculate period
    dates = [m.message_date for m in messages if m.message_date]
    period_start = min(dates) if dates else None
    period_end = max(dates) if dates else None

    # Call LLM
    try:
        content = await llm_client.generate(system_prompt, user_prompt)
    except Exception as e:
        raise RuntimeError(f"LLM generation failed: {e}") from e

    # Store digest
    digest = PulseDigest(
        user_id=user_id,
        category=category,
        content=content,
        message_count=len(messages),
        generated_at=datetime.now(timezone.utc),
        period_start=period_start,
        period_end=period_end,
    )
    db.add(digest)

    # Mark messages as processed
    for msg in messages:
        msg.status = "in_digest"

    await db.flush()
    await db.refresh(digest)

    logger.info(
        "Generated digest for user %s (category=%s): %d messages",
        user_id,
        category or "all",
        len(messages),
    )

    return digest
