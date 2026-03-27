"""AI Job Matching service — compares user profile against job description.

Uses a weighted multi-category rubric to compute match scores.
LLM rates 6 subcategories on a 1-5 scale; final score is computed in code
to avoid LLM middle-score clustering bias.
"""
import json
import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.job import Job
from app.models.profile import UserProfile
from app.models.user import User
from app.services.ai import get_llm_client
from app.services.profile_utils import build_profile_text
from app.services.prompt_assembly import assemble_prompt
from app.services.settings import get_or_create_settings, get_decrypted_key

logger = logging.getLogger(__name__)

CATEGORY_WEIGHTS = {
    "skills_match": 0.35,
    "experience_level": 0.25,
    "domain_relevance": 0.15,
    "role_alignment": 0.15,
    "location_fit": 0.05,
    "bonus_qualifications": 0.05,
}

CATEGORY_LABELS = {
    "skills_match": "Skills Match",
    "experience_level": "Experience Level",
    "domain_relevance": "Domain Relevance",
    "role_alignment": "Role Alignment",
    "location_fit": "Location Fit",
    "bonus_qualifications": "Bonus Qualifications",
}


def compute_weighted_score(ratings: dict) -> tuple[int, dict]:
    """Compute overall 0-100 score from subcategory ratings (1-5 each).

    Returns (score, validated_ratings) tuple.
    """
    validated = {}
    for key, weight in CATEGORY_WEIGHTS.items():
        val = ratings.get(key, 3)
        if not isinstance(val, (int, float)):
            val = 3
        validated[key] = max(1, min(5, int(val)))

    weighted_sum = sum(validated[k] * w for k, w in CATEGORY_WEIGHTS.items())
    # Map 1-5 weighted average to 0-100 scale
    score = round((weighted_sum - 1) / 4 * 100)
    return max(0, min(100, score)), validated


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
    profile_text = build_profile_text(profile)

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

    # Compute weighted score from subcategory ratings
    raw_ratings = match_result.get("ratings", {})
    if not isinstance(raw_ratings, dict):
        raw_ratings = {}
    score, ratings = compute_weighted_score(raw_ratings)

    score_breakdown = [
        {
            "category": key,
            "label": CATEGORY_LABELS[key],
            "rating": ratings[key],
            "weight": int(weight * 100),
        }
        for key, weight in CATEGORY_WEIGHTS.items()
    ]

    normalized = {
        "score": score,
        "score_breakdown": score_breakdown,
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
