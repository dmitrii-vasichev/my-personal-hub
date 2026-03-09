"""
Job hunt analytics service — query-based aggregations.
"""
import json
from collections import Counter
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import func, select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.job import Application, ApplicationStatus, Job
from app.models.resume import Resume
from app.models.user import User


async def get_funnel(db: AsyncSession, user: User) -> list[dict]:
    """Applications count per status (all 12)."""
    result = await db.execute(
        select(Application.status, func.count(Application.id).label("count"))
        .where(Application.user_id == user.id)
        .group_by(Application.status)
    )
    rows = result.all()
    counts = {str(r.status.value): r.count for r in rows}

    # Return all statuses in pipeline order
    order = [
        "found", "saved", "resume_generated", "applied",
        "screening", "technical_interview", "final_interview", "offer",
        "accepted", "rejected", "ghosted", "withdrawn",
    ]
    return [{"status": s, "count": counts.get(s, 0)} for s in order]


async def get_timeline(db: AsyncSession, user: User, weeks: int = 12) -> list[dict]:
    """Applications created per week for the last N weeks."""
    since = datetime.utcnow() - timedelta(weeks=weeks)
    result = await db.execute(
        select(Application.created_at)
        .where(Application.user_id == user.id, Application.created_at >= since)
        .order_by(Application.created_at)
    )
    rows = result.scalars().all()

    # Group by week (ISO week label)
    weekly: dict[str, int] = {}
    for dt in rows:
        week_label = dt.strftime("%Y-W%W")
        weekly[week_label] = weekly.get(week_label, 0) + 1

    # Fill in empty weeks
    points = []
    for i in range(weeks):
        d = datetime.utcnow() - timedelta(weeks=weeks - 1 - i)
        label = d.strftime("%Y-W%W")
        points.append({"week": label, "count": weekly.get(label, 0)})
    return points


async def get_skills_demand(db: AsyncSession, user: User, top_n: int = 20) -> list[dict]:
    """Most common tags across all jobs."""
    result = await db.execute(
        select(Job.tags).where(Job.user_id == user.id, Job.tags.isnot(None))
    )
    all_tags: list[str] = []
    for (tags,) in result.all():
        if isinstance(tags, list):
            all_tags.extend(tags)
        elif isinstance(tags, str):
            try:
                parsed = json.loads(tags)
                if isinstance(parsed, list):
                    all_tags.extend(parsed)
            except json.JSONDecodeError:
                pass

    counter = Counter(all_tags)
    return [{"skill": skill, "count": count} for skill, count in counter.most_common(top_n)]


async def get_sources(db: AsyncSession, user: User) -> list[dict]:
    """Job count by source."""
    result = await db.execute(
        select(Job.source, func.count(Job.id).label("count"))
        .where(Job.user_id == user.id)
        .group_by(Job.source)
        .order_by(func.count(Job.id).desc())
    )
    return [{"source": r.source, "count": r.count} for r in result.all()]


async def get_response_rates(db: AsyncSession, user: User) -> dict:
    """Conversion rates at key funnel stages."""
    result = await db.execute(
        select(Application.status, func.count(Application.id).label("count"))
        .where(Application.user_id == user.id)
        .group_by(Application.status)
    )
    counts = {str(r.status.value): r.count for r in result.all()}

    total = sum(counts.values())
    applied = counts.get("applied", 0)
    screening = counts.get("screening", 0)
    interview = counts.get("technical_interview", 0) + counts.get("final_interview", 0)
    offer = counts.get("offer", 0)
    accepted = counts.get("accepted", 0)

    def rate(num: int, den: int) -> float:
        return round(num / den * 100, 1) if den > 0 else 0.0

    return {
        "total_applications": total,
        "applied_count": applied,
        "screening_rate": rate(screening, applied),
        "interview_rate": rate(interview, applied),
        "offer_rate": rate(offer, applied),
        "acceptance_rate": rate(accepted, offer),
    }


async def get_ats_scores(db: AsyncSession, user: User) -> dict:
    """Average ATS score and distribution buckets."""
    result = await db.execute(
        select(Resume.ats_score)
        .join(Application, Application.id == Resume.application_id)
        .where(Application.user_id == user.id, Resume.ats_score.isnot(None))
    )
    scores = [r for (r,) in result.all()]
    if not scores:
        return {"average": None, "distribution": []}

    avg = round(sum(scores) / len(scores), 1)
    buckets = {"0-40": 0, "41-60": 0, "61-80": 0, "81-100": 0}
    for s in scores:
        if s <= 40:
            buckets["0-40"] += 1
        elif s <= 60:
            buckets["41-60"] += 1
        elif s <= 80:
            buckets["61-80"] += 1
        else:
            buckets["81-100"] += 1

    return {
        "average": avg,
        "distribution": [{"range": k, "count": v} for k, v in buckets.items()],
    }


async def get_summary(db: AsyncSession, user: User) -> dict:
    """Combined key metrics for the dashboard."""
    total_jobs = (await db.execute(
        select(func.count(Job.id)).where(Job.user_id == user.id)
    )).scalar_one()

    total_apps = (await db.execute(
        select(func.count(Application.id)).where(Application.user_id == user.id)
    )).scalar_one()

    rates = await get_response_rates(db, user)
    ats = await get_ats_scores(db, user)

    return {
        "total_jobs": total_jobs,
        "total_applications": total_apps,
        "interview_rate": rates["interview_rate"],
        "offer_rate": rates["offer_rate"],
        "avg_ats_score": ats["average"],
    }
