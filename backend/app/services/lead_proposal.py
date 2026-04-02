"""
Proposal generation service for outreach leads.

Flow: Lead + Industry template + User Profile → LLM → personalized proposal text.
"""
from __future__ import annotations

import logging
import re
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
a tech specialist who sets up small automations for local businesses — \
connecting their existing tools, pulling data into simple dashboards, \
and eliminating tedious manual steps.

You are NOT representing a company. {sender_name} is a private individual, \
a freelancer. Never use phrases like "our company", "our team", \
"our solutions". Always write in first person singular: "I", "my experience".

Your task: write a personalized cold email in {lang_name}.

# STRICT RULES

1. Every sentence must be specific to THIS business. No generic filler.
2. Reference 1 concrete micro-automation from the provided cases — \
frame it as what COULD be done for this business, a small specific win. \
Describe the result in hours saved per week, not percentages. \
NEVER present a case as something you already did for another client. \
Use framing like "I could set up…" or "one thing that often helps is…" — \
NEVER "I recently helped another business with…" or "my client saved…".
3. Do NOT mansplain — never explain to the business owner how their business works. \
Speak as a peer offering a specific technical fix.
4. Do NOT claim you researched or personally noticed problems in the recipient's \
business. You have NOT visited them or analyzed their operations. \
NEVER write "I noticed that…" / "Заметил, что…" / "I saw that your…". \
Instead, go straight to the value proposition: describe what you could help with.
5. ABSOLUTE HONESTY: NEVER fabricate past projects, past clients, or case studies. \
NEVER claim you worked with a similar business unless it is verifiably true. \
The recipient may ask for details — if you can't back it up, don't say it. \
Focus on what you COULD do, not what you supposedly DID.
6. FORBIDDEN words/phrases: "Leverage", "Delve into", "Streamline" (unless natural), \
"Fast-paced digital world", "In today's", "наши решения", "наша команда", \
"мы предлагаем", "широкий спектр", "consultant", "консультант", "optimize", \
"оптимизация", "digital transformation", "цифровая трансформация".
7. Keep it 3-4 SHORT paragraphs. Respect the reader's time.
8. CTA must be honest and low-pressure: suggest a brief chat to explore if \
one small automation could save them a few hours a week.
9. Use the sender's real name — NEVER use placeholders like [Your Name] or [Your Company].
10. Format as plain text suitable for email. No markdown headers, no bullet lists.
11. Your FIRST line must be a subject line in this exact format:
   Subject: <4-8 word subject line>
   Then leave one blank line and write the email body.
   SUBJECT LINE rules (apply ONLY to the subject, not the email body):
   - 4-8 words, curiosity-inducing
   - MUST mention the recipient's business name or a detail unique to THIS specific business \
(their location, a specific service they offer, or their niche). \
Generic industry subjects like "Вы экономите время на ручном вводе данных?" are FORBIDDEN — \
they look like mass-mailing templates.
   - Reference their business or problem — not your services
   - Subject starts with "You"/"Вы"/"Ваш" — never with "I"/"Я"
   - FORBIDDEN: "Commercial proposal", "Коммерческое предложение", \
"Quick question", "Following up", "Partnership opportunity", "Предложение о сотрудничестве"
   The email body MUST still start with a personal greeting (e.g. "Здравствуйте, [Name]!") \
followed by a brief self-introduction. Do NOT skip the greeting.

# TONE: SMALL AND APPROACHABLE

- Think "handyman for your spreadsheets", not "digital transformation partner".
- Frame every suggestion as ONE small, specific fix — not a transformation. \
The reader should think "that sounds easy and useful", not "that sounds like a big project".
- Signal that this is small-scale and affordable: a one-time setup, \
a few hours of work, costs less than a part-time assistant. \
Never mention exact prices, but make the scale feel approachable.
- Do NOT list multiple services or capabilities. Pick ONE thing \
that would obviously help THIS specific business.
- The email should feel like a neighbor offering to help fix a leaky faucet, \
not a contractor pitching a kitchen remodel.

# SIGNATURE

End the email with the sender's name. \
If a portfolio website URL is provided in the SENDER section, \
include it on a separate line below the name — no label, just the bare URL.
"""


def _build_user_prompt(
    business_name: str,
    contact_person: str | None,
    service_description: str | None,
    industry_name: str | None,
    cases: list | None,
    sender_name: str,
    sender_summary: str | None,
    sender_skills: list | None,
    sender_website: str | None,
    custom_instructions: str | None,
    language: str,
) -> str:
    """Build the user prompt from lead data, industry cases, and sender profile."""
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
    if sender_website:
        parts.append(f"Portfolio website: {sender_website}")

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

    if custom_instructions:
        parts.append(f"\n# ADDITIONAL INSTRUCTIONS\n{custom_instructions}")

    parts.append(
        f"\nWrite a personalized commercial proposal for this business in {language}."
    )

    return "\n".join(parts)


def _parse_subject(raw_text: str) -> tuple[str | None, str]:
    """Extract subject line from LLM response.

    Expected format:
        Subject: Some subject here

        Email body text...

    Returns (subject, body). If no subject found, returns (None, raw_text).
    """
    match = re.match(r"^Subject:\s*(.+)\n\n", raw_text, re.IGNORECASE)
    if match:
        subject = match.group(1).strip()
        body = raw_text[match.end():]
        return subject, body
    return None, raw_text


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
    sender_website = (profile.contacts or {}).get("website") if profile else None

    industry_name: str | None = None
    cases: list | None = None

    if lead.industry:
        industry_name = lead.industry.name
        if lead.industry.cases:
            cases = lead.industry.cases

    # Build prompt and call LLM
    user_prompt = _build_user_prompt(
        business_name=lead.business_name,
        contact_person=lead.contact_person,
        service_description=lead.service_description,
        industry_name=industry_name,
        cases=cases,
        sender_name=sender_name,
        sender_summary=sender_summary,
        sender_skills=sender_skills,
        sender_website=sender_website,
        custom_instructions=custom_instructions,
        language=language,
    )

    llm = get_llm_client("openai", api_key)
    raw_text = await llm.generate(
        get_system_prompt(language, sender_name), user_prompt
    )

    # Parse subject line from LLM response
    proposal_subject, proposal_text = _parse_subject(raw_text)

    # Save to lead
    lead.proposal_text = proposal_text
    lead.proposal_subject = proposal_subject
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
