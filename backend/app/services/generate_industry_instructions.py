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

DEFAULT_INDUSTRY_GENERATOR_PROMPT = """\
You are an expert B2B copywriter and Business Development strategist in the US market.
Your task is to generate a Markdown template (prompt_instructions) for a specific industry.
This template will be injected into a downstream LLM agent that writes cold outreach emails to small business owners in this industry.

Your goal is to instruct the downstream LLM on HOW to write the email, WHAT pain points to target, and WHAT solutions to offer, based entirely on the provided User Profile.

# CRITICAL STRATEGY RULES

1. Anti-SaaS Competition & Smart Integration
Never propose building a custom app that replaces their $5-$30/mo standard industry software (like Clio, Mindbody, Housecall Pro).
Instead, identify the 2-3 most common cheap SaaS tools used in the US for this industry.
Your proposed solution MUST focus on:
- API Integrations (connecting their cheap SaaS to other tools like accounting or CRM).
- Custom BI / Dashboards (pulling data from their fragmented tools into one clear view to show real ROI).
- Micro-automation (automating one specific painful manual step they currently do outside of their SaaS).

2. ROI & The "Invisible Assistant" (Micro-Automation)
Do not sell a "massive IT overhaul". Sell "Micro-Automation".
Frame the value as saving hours of manual data entry, acting like a digital assistant that runs in the background. Mention how this saves money compared to hiring an admin or suffering from missed invoices.

3. Complete Honesty (No Fake Case Studies)
NEVER instruct the downstream LLM to invent past experience or fake case studies (e.g., "I just built this for a similar firm").
The CTA must be strictly honest capability-based: "Open to a brief chat to see if connecting your tools could save your team a few hours a week?" or "Happy to share some ideas on how I'd approach automating this logic for your specific setup."

4. Strict "b2b-outreach" Tone of Voice
Include strict instructions for the downstream LLM to avoid AI-fluff words: DO NOT construct emails using words like "Leverage", "Delve into", "Streamline" (unless natural), "Fast-paced digital world".
Keep the downstream email under 3-5 short paragraphs.
NO Mansplaining: Do not tell the business owner how their business works. Speak to them as a peer offering a technical bridge.

# INPUT DATA
"""

CASES_EXTRACTION_PROMPT = """\
You are a structured data extractor. Given industry outreach instructions, \
extract 3-5 concrete automation cases that a freelance IT consultant can offer \
to businesses in this industry.

Each case must be a JSON object with these fields:
- "title": short name of the automation/integration (under 10 words)
- "problem": specific pain point this solves (1 sentence)
- "solution": what exactly to build/integrate (1 sentence)
- "result": expected business outcome — hours saved, errors reduced, etc. (1 sentence)

Output ONLY a valid JSON array. No other text, no markdown fences, no explanation.
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

    base_prompt = DEFAULT_INDUSTRY_GENERATOR_PROMPT
    if settings and settings.instruction_outreach_industry:
        base_prompt = settings.instruction_outreach_industry

    # 4. Construct user message
    user_msg = f"""
INDUSTRY: {industry.name}
INDUSTRY DESCRIPTION: {industry.description or 'No extra description provided.'}

USER PROFILE SUMMARY:
{profile_summary}

USER SKILLS:
{json.dumps(profile_skills, indent=2, ensure_ascii=False) if profile_skills else 'No specific skills listed'}

TASK:
Generate the detailed Markdown instructions (`prompt_instructions`) for this industry.
1. Outline the typical "Pain Points" using standard SaaS in this specific industry.
2. Outline the tailored "Solutions" based ONLY on the User Profile (dashboards, integrations, micro-automation).
3. Provide explicit "Tone & Outreach Instructions" with a safe, honest Soft CTA.
4. The final output must be ENTIRELY in {language}.
"""

    # 5. Call LLM for instructions
    api_key = await _get_openai_key(db, user)
    llm = get_llm_client("openai", api_key)

    generated_markdown = await llm.generate(base_prompt, user_msg)

    # 6. Extract structured cases from the generated instructions
    cases = await _extract_cases(llm, generated_markdown, industry.name)

    # 7. Save back to industry
    industry.prompt_instructions = generated_markdown
    industry.cases = cases
    await db.commit()
    await db.refresh(industry)

    return industry


async def _extract_cases(llm, instructions_markdown: str, industry_name: str) -> list:
    """Extract structured automation cases from generated industry instructions."""
    user_msg = f"Industry: {industry_name}\n\nInstructions:\n{instructions_markdown}"

    try:
        raw = await llm.generate(CASES_EXTRACTION_PROMPT, user_msg)
        # Strip markdown fences if LLM added them despite instructions
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
        logger.warning("Failed to extract structured cases for %s: %s", industry_name, e)

    return []
