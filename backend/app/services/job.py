from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import cast, or_, select, String
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.job import Application, Job
from app.models.user import User, UserRole
from app.schemas.job import JobCreate, JobUpdate


def _can_access(job: Job, user: User) -> bool:
    """Return True if user may read or write this job.

    Jobs are always private per user — no visibility field, no family sharing.
    """
    if user.role == UserRole.admin:
        return True
    return job.user_id == user.id


async def _load_job(db: AsyncSession, job_id: int) -> Job | None:
    """Load job by id."""
    result = await db.execute(
        select(Job)
        .where(Job.id == job_id)
    )
    return result.scalar_one_or_none()


async def _get_user_application(
    db: AsyncSession, job_id: int, user_id: int
) -> Application | None:
    """Return the application for this job belonging to user_id, or None."""
    result = await db.execute(
        select(Application).where(
            Application.job_id == job_id,
            Application.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


def _attach_application(job: Job, application: Application | None) -> Job:
    """Attach application as a transient attribute for serialisation."""
    job.application = application  # type: ignore[attr-defined]
    return job


# ── CRUD ──────────────────────────────────────────────────────────────────────


async def create_job(
    db: AsyncSession,
    data: JobCreate,
    current_user: User,
) -> Job:
    job = Job(
        user_id=current_user.id,
        title=data.title,
        company=data.company,
        location=data.location,
        url=data.url,
        source=data.source,
        description=data.description,
        salary_min=data.salary_min,
        salary_max=data.salary_max,
        salary_currency=data.salary_currency,
        match_score=data.match_score,
        tags=data.tags,
        found_at=data.found_at,
    )
    db.add(job)
    await db.flush()
    await db.commit()
    await db.refresh(job)
    # No application yet at creation time
    job.application = None  # type: ignore[attr-defined]
    return job


async def get_job(
    db: AsyncSession,
    job_id: int,
    current_user: User,
) -> Job | None:
    job = await _load_job(db, job_id)
    if job is None:
        return None
    if not _can_access(job, current_user):
        return None

    application = await _get_user_application(db, job_id, current_user.id)
    return _attach_application(job, application)


async def update_job(
    db: AsyncSession,
    job_id: int,
    data: JobUpdate,
    current_user: User,
) -> Job | None:
    job = await _load_job(db, job_id)
    if job is None or not _can_access(job, current_user):
        return None

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(job, field, value)

    job.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(job)

    application = await _get_user_application(db, job_id, current_user.id)
    return _attach_application(job, application)


async def delete_job(
    db: AsyncSession,
    job_id: int,
    current_user: User,
) -> bool:
    job = await _load_job(db, job_id)
    if job is None or not _can_access(job, current_user):
        return False
    await db.delete(job)
    await db.commit()
    return True


async def list_jobs(
    db: AsyncSession,
    current_user: User,
    search: Optional[str] = None,
    company: Optional[str] = None,
    source: Optional[str] = None,
    has_application: Optional[bool] = None,
    tags: Optional[str] = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
) -> list[Job]:
    q = select(Job)

    # Access control: regular users see only their own jobs
    if current_user.role != UserRole.admin:
        q = q.where(Job.user_id == current_user.id)

    # Search: ILIKE across title, company, description
    if search:
        pattern = f"%{search}%"
        q = q.where(
            or_(
                Job.title.ilike(pattern),
                Job.company.ilike(pattern),
                Job.description.ilike(pattern),
            )
        )

    # Exact company filter (case-insensitive)
    if company:
        q = q.where(Job.company.ilike(company))

    # Source filter (case-insensitive)
    if source:
        q = q.where(Job.source.ilike(source))

    # Tags filter: check that the JSON array contains this tag string
    if tags:
        # Cast the JSON column to text and use ILIKE to check for the tag value.
        # This is a simple approach; it also matches partial substrings, so we
        # wrap the value in quotes to match how PostgreSQL serialises JSON strings.
        tag_pattern = f'%"{tags}"%'
        q = q.where(cast(Job.tags, String).ilike(tag_pattern))

    # Sorting
    allowed_sort_fields = {"created_at", "company", "match_score"}
    sort_field = sort_by if sort_by in allowed_sort_fields else "created_at"
    sort_col = getattr(Job, sort_field, Job.created_at)
    q = q.order_by(sort_col.desc() if sort_order == "desc" else sort_col.asc())

    result = await db.execute(q)
    jobs = list(result.scalars().all())

    # Attach application summaries
    # For regular users we can look up all their applications in one query and
    # match them in Python; for admins we skip (has_application filter excluded).
    if current_user.role != UserRole.admin:
        job_ids = [j.id for j in jobs]
        if job_ids:
            apps_result = await db.execute(
                select(Application).where(
                    Application.user_id == current_user.id,
                    Application.job_id.in_(job_ids),
                )
            )
            apps_by_job: dict[int, Application] = {
                a.job_id: a for a in apps_result.scalars().all()
            }
        else:
            apps_by_job = {}

        # Apply has_application filter and attach
        filtered: list[Job] = []
        for job in jobs:
            app = apps_by_job.get(job.id)
            if has_application is True and app is None:
                continue
            if has_application is False and app is not None:
                continue
            job.application = app  # type: ignore[attr-defined]
            filtered.append(job)
        return filtered
    else:
        # Admin: has_application filter not applied (cross-user semantics unclear)
        for job in jobs:
            job.application = None  # type: ignore[attr-defined]
        return jobs
