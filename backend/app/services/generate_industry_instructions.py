import json
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.outreach import Industry
from app.models.profile import UserProfile
from app.models.settings import UserSettings
from app.models.user import User
from app.services.ai import get_llm_client
from app.core.encryption import decrypt_value

logger = logging.getLogger(__name__)

DEFAULT_INDUSTRY_TONE_PROMPT = """\
You are writing a SHORT industry-specific tone guide for cold email outreach \
to small business owners.

This guide will complement automation cases (provided separately) \
when generating cold outreach emails.

# RULES

- Output 5-10 lines of actionable tone guidance in plain text (no markdown headers)
- Focus ONLY on: how business owners in this industry prefer to be addressed, \
what language resonates, what to avoid, any professional nuances
- Do NOT list solutions, pain points, or automation ideas — those come from cases
- Do NOT repeat general email rules (formatting, length, CTA — handled elsewhere)
- Do NOT mention specific software tools

# INPUT DATA
"""

CASES_GENERATION_PROMPT = """\
You are generating concrete automation cases for a freelance IT specialist \
who helps small and medium businesses with lightweight automations.

Create 4-6 SPECIFIC automation scenarios for the given industry.

# RULES

1. Each case must describe a CONCRETE workflow, not a generic category.
   BAD: "API Integration between tools"
   GOOD: "Auto-create QuickBooks invoice when Housecall Pro job is marked complete"

2. Solutions must use lightweight tools appropriate for small business budgets:
   - Python/Node.js scripts, Google Apps Script, n8n/Make workflows
   - Simple custom web dashboards, API integrations between existing SaaS tools
   - NEVER mention Tableau, Power BI, Salesforce, or other enterprise platforms

3. Each case must be UNIQUE — different pain point, different workflow, different outcome.
   Do NOT repeat the same pattern (e.g. "sync X to Y") more than once.

4. Frame outcomes as hours saved per week/month or specific errors eliminated.
   Be realistic — a small automation saves 2-5 hours/week, not "transforms the business".

5. Mention specific SaaS tools commonly used by small businesses in this industry \
(the $5-30/mo tools, not enterprise software).

6. Base solutions on the sender's actual skills (provided below). \
If the sender knows Python and Google Sheets — propose scripts and spreadsheet automations. \
If they know n8n — propose workflow automations.

# OUTPUT FORMAT

Output ONLY a valid JSON array. No other text, no markdown fences, no explanation.

Each object must have exactly these fields:
- "title": specific name (under 10 words), e.g. "Auto-sync bookings to Google Calendar"
- "problem": what the owner currently does manually (1 sentence)
- "solution": what to build, mentioning specific tools (1 sentence)
- "result": measurable outcome — hours/week saved, error reduction (1 sentence)
"""

async def _get_openai_key(db: AsyncSession, user: User) -> str:
    result = await db.execute(select(UserSettings).where(UserSettings.user_id == user.id))
    settings = result.scalar_one_or_none()
    if not settings or not settings.api_key_openai:
        raise ValueError("OpenAI API key is not configured in settings")
    return decrypt_value(settings.api_key_openai)

async def generate_industry_instructions_for_industry(
    db: AsyncSession,
    user: User,
    industry_id: int,
    language: str = "English"
) -> Industry:
    # 1. Fetch industry
    result = await db.execute(select(Industry).where(Industry.id == industry_id, Industry.user_id == user.id))
    industry = result.scalar_one_or_none()
    if not industry:
        raise ValueError("Industry not found")

    # 2. Fetch User Profile
    result = await db.execute(select(UserProfile).where(UserProfile.user_id == user.id))
    profile = result.scalar_one_or_none()
    profile_summary = profile.summary if profile else "No profile summary available."
    profile_skills = profile.skills if profile else []

    # 3. Fetch User Settings for the custom prompt override
    result = await db.execute(select(UserSettings).where(UserSettings.user_id == user.id))
    settings = result.scalar_one_or_none()

    api_key = await _get_openai_key(db, user)
    llm = get_llm_client("openai", api_key)

    # 4. Generate short tone guide
    tone_prompt = DEFAULT_INDUSTRY_TONE_PROMPT
    if settings and settings.instruction_outreach_industry:
        tone_prompt = settings.instruction_outreach_industry

    tone_msg = f"""
INDUSTRY: {industry.name}
INDUSTRY DESCRIPTION: {industry.description or 'No extra description provided.'}

Generate a short tone guide for cold email outreach to business owners in this industry.
Write entirely in {language}.
"""
    generated_tone = await llm.generate(tone_prompt, tone_msg)

    # 5. Generate cases independently
    cases = await _generate_cases(
        llm, industry.name, industry.description,
        profile_summary, profile_skills, language,
    )

    # 6. Save back to industry
    industry.prompt_instructions = generated_tone
    industry.cases = cases
    await db.commit()
    await db.refresh(industry)

    return industry


async def _generate_cases(
    llm,
    industry_name: str,
    industry_description: str | None,
    profile_summary: str,
    profile_skills: list,
    language: str,
) -> list:
    """Generate structured automation cases for an industry based on sender profile."""
    user_msg = f"""
INDUSTRY: {industry_name}
INDUSTRY DESCRIPTION: {industry_description or 'No extra description provided.'}

SENDER PROFILE SUMMARY:
{profile_summary}

SENDER SKILLS:
{json.dumps(profile_skills, indent=2, ensure_ascii=False) if profile_skills else 'No specific skills listed'}

Generate 4-6 automation cases for businesses in this industry.
Each case must be actionable by a freelancer with the skills listed above.
Output in {language}.
"""

    try:
        raw = await llm.generate(CASES_GENERATION_PROMPT, user_msg)
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            cleaned = cleaned.strip()
        cases = json.loads(cleaned)
        if isinstance(cases, list):
            return cases
    except (json.JSONDecodeError, Exception) as e:
        logger.warning("Failed to generate cases for %s: %s", industry_name, e)

    return []
