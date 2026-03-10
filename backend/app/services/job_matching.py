"""AI Job Matching service — compares user profile against job description."""
import json
import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.job import Job
from app.models.profile import UserProfile
from app.models.user import User
from app.services.ai import get_llm_client
from app.services.prompt_assembly import assemble_prompt
from app.services.settings import get_or_create_settings, get_decrypted_key

logger = logging.getLogger(__name__)


async def match_job(db: AsyncSession, job_id: int, user: User) -> dict:
    """Run AI matching for a job against the user's profile.

    Returns the match result dict with score, matched_skills, etc.
    Raises ValueError on validation errors, RuntimeError on LLM errors.
    """
    # 1. Get job
    result = await db.execute(
        select(Job).where(Job.id == job_id, Job.user_id == user.id)
    )
    job = result.scalar_one_or_none()
    if job is None:
        raise ValueError("Job not found")

    # 2. Get user profile
    result = await db.execute(
        select(UserProfile).where(UserProfile.user_id == user.id)
    )
    profile = result.scalar_one_or_none()
    if profile is None:
        raise ValueError("No user profile found. Please set up your profile first.")

    # 3. Build profile text for context
    profile_text_parts = []
    if profile.summary:
        profile_text_parts.append(f"Summary: {profile.summary}")
    if profile.skills:
        skill_names = [s.get("name", "") for s in profile.skills if isinstance(s, dict)]
        profile_text_parts.append(f"Skills: {', '.join(skill_names)}")
    if profile.experience:
        for exp in profile.experience:
            if isinstance(exp, dict):
                line = f"- {exp.get('title', '')} at {exp.get('company', '')}"
                if exp.get("description"):
                    line += f": {exp['description']}"
                profile_text_parts.append(line)
    if profile.education:
        for edu in profile.education:
            if isinstance(edu, dict):
                profile_text_parts.append(
                    f"- {edu.get('degree', '')} from {edu.get('institution', '')}"
                )
    profile_text = "\n".join(profile_text_parts)

    # 4. Assemble prompt
    context = {
        "job_description": job.description or "",
        "job_title": job.title,
        "company": job.company,
        "user_profile": profile_text,
    }
    system_prompt, user_prompt = await assemble_prompt(
        db, user, "job_matching", context
    )

    # 5. Call LLM
    settings = await get_or_create_settings(db, user)
    provider = settings.llm_provider or "openai"
    api_key = get_decrypted_key(settings, f"api_key_{provider}")
    if not api_key:
        raise ValueError(f"No API key configured for provider '{provider}'. Set it in Settings.")

    llm = get_llm_client(provider, api_key)
    try:
        raw = await llm.generate(system_prompt, user_prompt)
    except Exception as exc:
        logger.error("LLM call failed for job matching: %s", exc)
        raise RuntimeError("AI matching failed. Please try again later.")

    # 6. Parse JSON response
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]

    try:
        match_result = json.loads(raw)
    except json.JSONDecodeError:
        logger.error("Failed to parse LLM response: %s", raw[:500])
        raise RuntimeError("AI returned invalid response. Please try again.")

    # Validate required fields
    score = match_result.get("score", 0)
    if not isinstance(score, (int, float)):
        score = 0
    score = max(0, min(100, int(score)))

    normalized = {
        "score": score,
        "matched_skills": match_result.get("matched_skills", []),
        "missing_skills": match_result.get("missing_skills", []),
        "strengths": match_result.get("strengths", []),
        "recommendations": match_result.get("recommendations", []),
    }

    # 7. Save to job record
    job.match_score = normalized["score"]
    job.match_result = normalized
    job.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(job)

    return normalized
