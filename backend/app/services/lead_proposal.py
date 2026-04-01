"""
Proposal generation service for outreach leads.

Flow: Lead + Industry template + User Profile → LLM → personalized proposal text.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select

from app.core.encryption import decrypt_value
from app.models.outreach import Lead
from app.models.profile import UserProfile
from app.models.settings import UserSettings
from app.models.user import User
from app.services.ai import get_llm_client

logger = logging.getLogger(__name__)


def get_system_prompt(language: str, sender_name: str) -> str:
    lang_name = language.lower()
    return f"""\
You are writing a cold outreach email on behalf of {sender_name}, \
an independent automation and IT consultant who helps US small businesses \
save time by connecting their existing tools, building custom dashboards, \
and automating painful manual steps.

You are NOT representing a company. {sender_name} is a private individual, \
a freelance specialist. Never use phrases like "our company", "our team", \
"our solutions". Always write in first person singular: "I", "my experience".

Your task: write a personalized commercial proposal in {lang_name}.

# STRICT RULES

1. Every sentence must be specific to THIS business. No generic filler.
2. Reference 1-2 concrete automation cases from the provided list — \
pick the most relevant ones for this business.
3. Do NOT mansplain — never explain to the business owner how their business works. \
Speak as a peer offering a technical bridge.
4. FORBIDDEN words/phrases: "Leverage", "Delve into", "Streamline" (unless natural), \
"Fast-paced digital world", "In today's", "наши решения", "наша команда", \
"мы предлагаем", "широкий спектр".
5. Keep it 3-5 SHORT paragraphs. Respect the reader's time.
6. CTA must be honest and low-pressure: suggest a brief chat to explore if \
connecting their tools could save them time. No fake case studies, no invented past projects.
7. Use the sender's real name — NEVER use placeholders like [Your Name] or [Your Company].
8. Format as plain text suitable for email. No markdown headers, no bullet lists.
"""


def _build_user_prompt(
    business_name: str,
    contact_person: str | None,
    service_description: str | None,
    industry_name: str | None,
    template_content: str | None,
    cases: list | None,
    sender_name: str,
    sender_summary: str | None,
    sender_skills: list | None,
    custom_instructions: str | None,
    language: str,
) -> str:
    """Build the user prompt from lead data, industry template, and sender profile."""
    parts: list[str] = []

    parts.append("# RECIPIENT")
    parts.append(f"Business: {business_name}")
    if contact_person:
        parts.append(f"Contact person: {contact_person}")
    if industry_name:
        parts.append(f"Industry: {industry_name}")
    if service_description:
        parts.append(f"Their services: {service_description}")

    parts.append("\n# SENDER")
    parts.append(f"Name: {sender_name}")
    if sender_summary:
        parts.append(f"Profile: {sender_summary}")
    if sender_skills:
        skill_names = [s.get("name", "") if isinstance(s, dict) else str(s) for s in sender_skills[:15]]
        parts.append(f"Skills: {', '.join(skill_names)}")

    if cases:
        parts.append("\n# AUTOMATION CASES (pick 1-2 most relevant)")
        for i, case in enumerate(cases, 1):
            title = case.get("title", "")
            problem = case.get("problem", "")
            solution = case.get("solution", "")
            result = case.get("result", "")
            parts.append(f"\n## Case {i}: {title}")
            if problem:
                parts.append(f"Problem: {problem}")
            if solution:
                parts.append(f"Solution: {solution}")
            if result:
                parts.append(f"Result: {result}")

    if template_content:
        parts.append(
            f"\n# INDUSTRY OUTREACH INSTRUCTIONS\n{template_content}"
        )

    if custom_instructions:
        parts.append(f"\n# ADDITIONAL INSTRUCTIONS\n{custom_instructions}")

    parts.append(
        f"\nWrite a personalized commercial proposal for this business in {language}."
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


async def _get_user_profile(db: AsyncSession, user: User) -> UserProfile | None:
    """Fetch the user's profile for sender context."""
    result = await db.execute(
        select(UserProfile).where(UserProfile.user_id == user.id)
    )
    return result.scalar_one_or_none()


async def generate_proposal(
    db: AsyncSession,
    user: User,
    lead_id: int,
    custom_instructions: str | None = None,
    language: str = "Russian",
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

    # Get API key and user profile
    api_key = await _get_openai_key(db, user)
    profile = await _get_user_profile(db, user)

    sender_name = user.display_name
    sender_summary = profile.summary if profile else None
    sender_skills = profile.skills if profile else None

    template_content: str | None = None
    industry_name: str | None = None
    cases: list | None = None

    if lead.industry:
        industry_name = lead.industry.name
        if lead.industry.prompt_instructions:
            template_content = lead.industry.prompt_instructions
        if lead.industry.cases:
            cases = lead.industry.cases

    # Build prompt and call LLM
    user_prompt = _build_user_prompt(
        business_name=lead.business_name,
        contact_person=lead.contact_person,
        service_description=lead.service_description,
        industry_name=industry_name,
        template_content=template_content,
        cases=cases,
        sender_name=sender_name,
        sender_summary=sender_summary,
        sender_skills=sender_skills,
        custom_instructions=custom_instructions,
        language=language,
    )

    llm = get_llm_client("openai", api_key)
    proposal_text = await llm.generate(
        get_system_prompt(language, sender_name), user_prompt
    )

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
