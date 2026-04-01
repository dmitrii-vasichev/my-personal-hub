"""
Proposal generation service for outreach leads.

Flow: Lead + Industry template (Google Drive Markdown) → LLM → personalized proposal text.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select

from app.core.encryption import decrypt_value
from app.models.outreach import Lead
from app.models.settings import UserSettings
from app.models.user import User
from app.services.ai import get_llm_client

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """\
You are an expert business development consultant specializing in cold outreach \
for automation and IT services targeting Russian-speaking businesses in the US.

Your task is to write a personalized commercial proposal (коммерческое предложение) \
in Russian for a specific business.

Rules:
- Write in professional but friendly Russian.
- Be specific to the business — reference their industry and services.
- Highlight how automation/IT services can solve their particular pain points.
- Keep it concise: 3-5 paragraphs.
- Include a clear call to action at the end.
- Do NOT use generic filler — every sentence should be relevant to this business.
- Format as plain text (no markdown headers), suitable for email or messenger.
"""


def _build_user_prompt(
    business_name: str,
    service_description: str | None,
    industry_name: str | None,
    template_content: str | None,
    custom_instructions: str | None,
) -> str:
    """Build the user prompt from lead data and optional template."""
    parts: list[str] = []

    parts.append(f"Бизнес: {business_name}")

    if industry_name:
        parts.append(f"Отрасль: {industry_name}")

    if service_description:
        parts.append(f"Описание услуг бизнеса: {service_description}")

    if template_content:
        parts.append(
            f"\n--- Шаблон предложения для этой отрасли ---\n{template_content}\n---"
        )

    if custom_instructions:
        parts.append(f"\nДополнительные инструкции: {custom_instructions}")

    parts.append(
        "\nНапиши персонализированное коммерческое предложение для этого бизнеса."
    )

    return "\n".join(parts)


async def _get_openai_key(db: AsyncSession, user: User) -> str:
    """Retrieve and decrypt the user's OpenAI API key."""
    result = await db.execute(
        select(UserSettings).where(UserSettings.user_id == user.id)
    )
    settings = result.scalar_one_or_none()
    if not settings or not settings.api_key_openai:
        raise ValueError("OpenAI API key is not configured in settings")
    return decrypt_value(settings.api_key_openai)


async def generate_proposal(
    db: AsyncSession,
    user: User,
    lead_id: int,
    custom_instructions: str | None = None,
) -> Lead | None:
    """Generate a personalized proposal for a lead and save it.

    Returns the updated Lead with proposal_text populated, or None if lead not found.
    """
    # Load lead with industry relationship
    result = await db.execute(
        select(Lead)
        .where(Lead.id == lead_id)
        .options(selectinload(Lead.industry), selectinload(Lead.status_history))
    )
    lead = result.scalar_one_or_none()
    if lead is None or lead.user_id != user.id:
        return None

    # Get API key
    api_key = await _get_openai_key(db, user)

    template_content: str | None = None
    industry_name: str | None = None

    if lead.industry:
        industry_name = lead.industry.name
        if lead.industry.prompt_instructions:
            template_content = lead.industry.prompt_instructions

    # Build prompt and call LLM
    user_prompt = _build_user_prompt(
        business_name=lead.business_name,
        service_description=lead.service_description,
        industry_name=industry_name,
        template_content=template_content,
        custom_instructions=custom_instructions,
    )

    llm = get_llm_client("openai", api_key)
    proposal_text = await llm.generate(SYSTEM_PROMPT, user_prompt)

    # Save to lead
    lead.proposal_text = proposal_text
    lead.updated_at = datetime.now(timezone.utc)
    await db.commit()

    # Reload to get fresh relationships
    await db.refresh(lead)
    result = await db.execute(
        select(Lead)
        .where(Lead.id == lead_id)
        .options(selectinload(Lead.industry), selectinload(Lead.status_history))
    )
    return result.scalar_one_or_none()
