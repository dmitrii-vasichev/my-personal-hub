"""Digest generation service for Pulse.

Groups new messages by category/subcategory/source, builds prompts,
calls the user's LLM provider, and stores structured markdown summaries.
For Learning and Jobs categories, generates structured digest items instead of markdown.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.telegram import PulseDigest, PulseDigestItem, PulseMessage, PulseSource

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

def count_digest_items(content: str) -> int:
    """Count bullet-point items in generated markdown digest."""
    count = 0
    for line in content.splitlines():
        stripped = line.strip()
        if stripped.startswith(("- ", "* ", "• ")) or (
            len(stripped) >= 3 and stripped[0].isdigit() and ". " in stripped[:5]
        ):
            count += 1
    return count


LEARNING_STRUCTURED_PROMPT = """You are a learning content curator. Given a batch of educational messages from Telegram channels, extract structured items.

Return ONLY a valid JSON array. Each element must be an object with these fields:
- "title": string (concise title, max 100 chars)
- "summary": string (1-3 sentence description of why this is valuable)
- "classification": one of "article", "lifehack", "insight", "tool", "other"
- "source_names": array of source names this item comes from
- "message_indices": array of 0-based indices of messages used for this item

Rules:
- Merge messages about the same topic into one item
- Skip spam, ads, and irrelevant content
- Write in the same language as the original messages
- Return at least 1 item if there's any useful content"""

JOBS_STRUCTURED_PROMPT = """You are a job market analyst. Given a batch of job-related messages from Telegram channels, extract structured vacancy items.

Return ONLY a valid JSON array. Each element must be an object with these fields:
- "title": string (concise title like "Senior Python Developer at TechCorp")
- "summary": string (key requirements, benefits, and why it's notable)
- "classification": "vacancy"
- "metadata": object with optional fields: "company" (string), "position" (string), "salary_range" (string like "$150k-$200k"), "location" (string), "url" (string)
- "source_names": array of source names this item comes from
- "message_indices": array of 0-based indices of messages used for this item

Rules:
- Each distinct job posting should be a separate item
- Extract company, position, salary, location, URL when mentioned
- Skip non-vacancy messages (discussions, advice, etc.)
- Write in the same language as the original messages
- Return at least 1 item if there's any job posting"""

CATEGORY_PROMPTS = {
    "news": NEWS_SYSTEM_PROMPT,
    "jobs": JOBS_SYSTEM_PROMPT,
    "learning": LEARNING_SYSTEM_PROMPT,
}

STRUCTURED_PROMPTS = {
    "learning": LEARNING_STRUCTURED_PROMPT,
    "jobs": JOBS_STRUCTURED_PROMPT,
}


def _build_user_prompt(
    messages: list[PulseMessage],
    sources_map: dict[int, PulseSource],
) -> str:
    """Build a structured user prompt from grouped messages."""
    # Group messages: source subcategory -> source_id -> messages
    grouped: dict[str, dict[int, list[PulseMessage]]] = {}
    for msg in messages:
        source = sources_map.get(msg.source_id)
        sub = (source.subcategory if source else None) or "General"
        grouped.setdefault(sub, {}).setdefault(msg.source_id, []).append(msg)

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
    pulse_settings=None,
) -> PulseDigest | None:
    """Generate a digest from new messages.

    Args:
        db: Database session.
        user_id: Owner user ID.
        llm_client: Configured LLM adapter.
        category: Optional category filter (news/jobs/learning). None = all.
        pulse_settings: Optional PulseSettings with custom prompts.

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

    # Calculate period
    dates = [m.message_date for m in messages if m.message_date]
    period_start = min(dates) if dates else None
    period_end = max(dates) if dates else None

    user_prompt = _build_user_prompt(messages, sources_map)

    # Determine if structured output is needed
    use_structured = effective_category in STRUCTURED_PROMPTS

    if use_structured:
        digest = await _generate_structured_digest(
            db, user_id, llm_client, messages, sources_map,
            effective_category, user_prompt, period_start, period_end,
            pulse_settings,
        )
    else:
        digest = await _generate_markdown_digest(
            db, user_id, llm_client, effective_category, user_prompt,
            messages, period_start, period_end, pulse_settings,
        )

    # Mark messages as processed
    for msg in messages:
        msg.status = "in_digest"

    await db.flush()
    await db.refresh(digest)

    logger.info(
        "Generated digest for user %s (category=%s, type=%s): %d messages",
        user_id,
        category or "all",
        digest.digest_type,
        len(messages),
    )

    return digest


async def _generate_markdown_digest(
    db: AsyncSession,
    user_id: int,
    llm_client: "LLMAdapter",
    effective_category: str,
    user_prompt: str,
    messages: list[PulseMessage],
    period_start: datetime | None,
    period_end: datetime | None,
    pulse_settings=None,
) -> PulseDigest:
    """Generate a traditional markdown digest."""
    system_prompt = CATEGORY_PROMPTS.get(effective_category, NEWS_SYSTEM_PROMPT)

    if pulse_settings:
        custom_field = f"prompt_{effective_category}"
        custom_prompt = getattr(pulse_settings, custom_field, None)
        if custom_prompt:
            system_prompt = custom_prompt

    try:
        content = await llm_client.generate(system_prompt, user_prompt)
    except Exception as e:
        raise RuntimeError(f"LLM generation failed: {e}") from e

    digest = PulseDigest(
        user_id=user_id,
        category=effective_category,
        content=content,
        digest_type="markdown",
        message_count=len(messages),
        items_count=count_digest_items(content),
        generated_at=datetime.now(timezone.utc),
        period_start=period_start,
        period_end=period_end,
    )
    db.add(digest)
    return digest


async def _generate_structured_digest(
    db: AsyncSession,
    user_id: int,
    llm_client: "LLMAdapter",
    messages: list[PulseMessage],
    sources_map: dict[int, PulseSource],
    effective_category: str,
    user_prompt: str,
    period_start: datetime | None,
    period_end: datetime | None,
    pulse_settings=None,
) -> PulseDigest:
    """Generate a structured digest with individual items (Learning/Jobs)."""
    system_prompt = STRUCTURED_PROMPTS[effective_category]

    if pulse_settings:
        custom_field = f"prompt_{effective_category}"
        custom_prompt = getattr(pulse_settings, custom_field, None)
        if custom_prompt:
            system_prompt = custom_prompt

    try:
        raw_response = await llm_client.generate(system_prompt, user_prompt)
    except Exception as e:
        raise RuntimeError(f"LLM generation failed: {e}") from e

    # Try parsing structured JSON
    try:
        items_data = _parse_llm_json(raw_response)
    except (json.JSONDecodeError, ValueError):
        logger.warning(
            "Structured digest JSON parse failed for user %s (category=%s), falling back to markdown",
            user_id, effective_category,
        )
        # Fallback: re-generate as markdown
        return await _generate_markdown_digest(
            db, user_id, llm_client, effective_category, user_prompt,
            messages, period_start, period_end, pulse_settings,
        )

    now = datetime.now(timezone.utc)
    digest = PulseDigest(
        user_id=user_id,
        category=effective_category,
        content=None,
        digest_type="structured",
        message_count=len(messages),
        items_count=len(items_data),
        generated_at=now,
        period_start=period_start,
        period_end=period_end,
    )
    db.add(digest)
    await db.flush()

    # Create digest items
    for item_data in items_data:
        # Map message_indices to actual message IDs
        msg_indices = item_data.get("message_indices", [])
        source_msg_ids = []
        for idx in msg_indices:
            if 0 <= idx < len(messages):
                source_msg_ids.append(messages[idx].id)

        # Resolve source names from message indices if not provided
        source_names = item_data.get("source_names") or []
        if not source_names and msg_indices:
            seen = set()
            for idx in msg_indices:
                if 0 <= idx < len(messages):
                    source = sources_map.get(messages[idx].source_id)
                    if source and source.title not in seen:
                        source_names.append(source.title)
                        seen.add(source.title)

        digest_item = PulseDigestItem(
            digest_id=digest.id,
            user_id=user_id,
            title=(item_data.get("title") or "Untitled")[:500],
            summary=item_data.get("summary") or "",
            classification=item_data.get("classification") or "other",
            metadata_=item_data.get("metadata"),
            source_names=source_names,
            source_message_ids=source_msg_ids,
            status="new",
            created_at=now,
        )
        db.add(digest_item)

    return digest


def _parse_llm_json(response: str) -> list[dict]:
    """Parse LLM response as JSON array, handling markdown code blocks."""
    clean = response.strip()
    if clean.startswith("```"):
        clean = clean.split("\n", 1)[1].rsplit("```", 1)[0].strip()

    data = json.loads(clean)
    if not isinstance(data, list):
        raise ValueError("Expected JSON array")
    return data
