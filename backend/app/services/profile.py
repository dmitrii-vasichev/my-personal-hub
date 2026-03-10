"""User profile service — CRUD + AI-powered import from text."""
import json
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.profile import UserProfile
from app.models.user import User
from app.schemas.profile import ProfileUpdate
from app.services.ai import get_llm_client
from app.services.settings import get_or_create_settings, get_decrypted_key


IMPORT_SYSTEM = """You are an expert resume parser. Extract structured profile data from raw text.
Output ONLY valid JSON matching this exact schema — no markdown, no extra text:
{
  "summary": string or null,
  "skills": [{"name": string, "level": string or null, "years": number or null}],
  "experience": [{"title": string, "company": string, "location": string or null, "start_date": string or null, "end_date": string or null, "description": string or null}],
  "education": [{"degree": string, "institution": string, "year": number or null}],
  "contacts": {"email": string or null, "phone": string or null, "linkedin": string or null, "location": string or null}
}"""

IMPORT_USER = """Parse the following text into a structured profile.
Extract all available information. If a field is not present, use null.

TEXT:
{text}"""


async def get_profile(db: AsyncSession, user: User) -> Optional[UserProfile]:
    result = await db.execute(
        select(UserProfile).where(UserProfile.user_id == user.id)
    )
    return result.scalar_one_or_none()


async def upsert_profile(
    db: AsyncSession, user: User, data: ProfileUpdate
) -> UserProfile:
    profile = await get_profile(db, user)
    if profile is None:
        profile = UserProfile(user_id=user.id)
        db.add(profile)

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "contacts" and value is not None:
            setattr(profile, field, value)
        elif value is not None:
            setattr(profile, field, value)

    profile.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(profile)
    return profile


async def import_profile_from_text(
    db: AsyncSession, user: User, text: str
) -> UserProfile:
    """Parse raw text (resume/LinkedIn export) into structured profile via LLM."""
    settings = await get_or_create_settings(db, user)
    provider = settings.llm_provider or "openai"
    key_field = f"api_key_{provider}"
    api_key = get_decrypted_key(settings, key_field)
    if not api_key:
        raise ValueError(f"No API key configured for provider '{provider}'. Set it in Settings.")

    llm = get_llm_client(provider, api_key)
    raw = await llm.generate(
        system_prompt=IMPORT_SYSTEM,
        user_prompt=IMPORT_USER.format(text=text),
    )

    # Strip markdown fences if present
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    parsed = json.loads(raw)

    profile = await get_profile(db, user)
    if profile is None:
        profile = UserProfile(user_id=user.id)
        db.add(profile)

    profile.summary = parsed.get("summary")
    profile.skills = parsed.get("skills", [])
    profile.experience = parsed.get("experience", [])
    profile.education = parsed.get("education", [])
    profile.contacts = parsed.get("contacts", {})
    profile.raw_import = text
    profile.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(profile)
    return profile
