from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy import and_, asc, cast, desc, func, or_, select, String
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.job import ApplicationStatus, Job, StatusHistory
from app.models.user import User, UserRole
from app.schemas.job import JobCreate, JobStatusChange, JobTrackingUpdate, JobUpdate


class DuplicateJobError(Exception):
    """Raised when a job with the same URL or title+company already exists."""

    def __init__(self, existing_job: Job):
        self.existing_job = existing_job
        super().__init__(f"Job already exists (id={existing_job.id})")


def _exclude_demo_owners(owner_id_col):
    """Exclude records owned by demo users."""
    demo_ids = select(User.id).where(User.role == UserRole.demo)
    return ~owner_id_col.in_(demo_ids)


def _can_access(job: Job, user: User) -> bool:
    if user.role == UserRole.admin:
        return True
    return job.user_id == user.id


async def _load_job(db: AsyncSession, job_id: int) -> Job | None:
    result = await db.execute(
        select(Job).where(Job.id == job_id)
    )
    return result.scalar_one_or_none()


async def _load_job_with_history(db: AsyncSession, job_id: int) -> Job | None:
    result = await db.execute(
        select(Job)
        .where(Job.id == job_id)
        .options(selectinload(Job.status_history))
    )
    return result.scalar_one_or_none()


# ── CRUD ──────────────────────────────────────────────────────────────────────


async def _find_existing_job(
    db: AsyncSession,
    user_id: int,
    url: str | None,
    title: str,
    company: str,
) -> Job | None:
    """Find an existing job by URL (preferred) or title+company fallback."""
    if url:
        result = await db.execute(
            select(Job).where(and_(Job.user_id == user_id, Job.url == url))
        )
        existing = result.scalar_one_or_none()
        if existing:
            return existing

    result = await db.execute(
        select(Job).where(
            and_(
                Job.user_id == user_id,
                func.lower(Job.title) == title.lower(),
                func.lower(Job.company) == company.lower(),
            )
        )
    )
    return result.scalar_one_or_none()


async def create_job(
    db: AsyncSession,
    data: JobCreate,
    current_user: User,
) -> Job:
    existing = await _find_existing_job(
        db, current_user.id, data.url, data.title, data.company
    )
    if existing:
        raise DuplicateJobError(existing)

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
        salary_period=data.salary_period,
        match_score=data.match_score,
        tags=data.tags,
        found_at=data.found_at,
        status=data.status or ApplicationStatus.found,
    )

    if data.status == ApplicationStatus.applied:
        job.applied_date = date.today()

    db.add(job)
    await db.flush()

    # Create initial status history entry
    history_entry = StatusHistory(
        job_id=job.id,
        old_status=None,
        new_status=job.status.value,
    )
    db.add(history_entry)

    await db.commit()
    return await _load_job_with_history(db, job.id)  # type: ignore[return-value]


async def get_job(
    db: AsyncSession,
    job_id: int,
    current_user: User,
) -> Job | None:
    job = await _load_job_with_history(db, job_id)
    if job is None:
        return None
    if not _can_access(job, current_user):
        return None
    return job


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
    return await _load_job_with_history(db, job_id)


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
    status: Optional[str] = None,
    tags: Optional[str] = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
) -> list[Job]:
    q = select(Job).options(selectinload(Job.status_history))

    if current_user.role == UserRole.demo:
        q = q.where(Job.user_id == current_user.id)
    elif current_user.role == UserRole.admin:
        q = q.where(_exclude_demo_owners(Job.user_id))
    else:
        q = q.where(Job.user_id == current_user.id)

    if search:
        pattern = f"%{search}%"
        q = q.where(
            or_(
                Job.title.ilike(pattern),
                Job.company.ilike(pattern),
                Job.description.ilike(pattern),
            )
        )

    if company:
        q = q.where(Job.company.ilike(company))

    if source:
        q = q.where(Job.source.ilike(source))

    # Status filter: comma-separated values
    if status:
        status_values = [s.strip() for s in status.split(",") if s.strip()]
        if status_values:
            q = q.where(Job.status.in_(status_values))

    if tags:
        tag_pattern = f'%"{tags}"%'
        q = q.where(cast(Job.tags, String).ilike(tag_pattern))

    # Sorting
    allowed_sort_fields = {
        "created_at", "company", "match_score", "title", "source", "found_at",
        "updated_at", "applied_date", "next_action_date",
    }
    sort_field = sort_by if sort_by in allowed_sort_fields else "created_at"
    sort_col = getattr(Job, sort_field, Job.created_at)
    order_fn = asc if sort_order == "asc" else desc
    q = q.order_by(order_fn(sort_col))

    result = await db.execute(q)
    return list(result.scalars().all())


# ── Status & Tracking ─────────────────────────────────────────────────────────


async def change_status(
    db: AsyncSession,
    job_id: int,
    data: JobStatusChange,
    current_user: User,
) -> Job | None:
    job = await _load_job(db, job_id)
    if job is None or not _can_access(job, current_user):
        return None

    if data.new_status == job.status:
        return await _load_job_with_history(db, job_id)

    old_status = job.status.value if job.status else None

    if data.new_status == ApplicationStatus.applied and job.applied_date is None:
        job.applied_date = date.today()

    job.status = data.new_status
    job.updated_at = datetime.now(timezone.utc)

    history_entry = StatusHistory(
        job_id=job.id,
        old_status=old_status,
        new_status=data.new_status.value,
        comment=data.comment,
    )
    db.add(history_entry)

    await db.commit()
    return await _load_job_with_history(db, job_id)


async def update_tracking(
    db: AsyncSession,
    job_id: int,
    data: JobTrackingUpdate,
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
    return await _load_job_with_history(db, job_id)


# ── Kanban & History ──────────────────────────────────────────────────────────


async def get_kanban(
    db: AsyncSession,
    current_user: User,
) -> dict[str, list[Job]]:
    query = select(Job).where(Job.status.isnot(None))
    if current_user.role == UserRole.demo:
        query = query.where(Job.user_id == current_user.id)
    elif current_user.role == UserRole.admin:
        query = query.where(_exclude_demo_owners(Job.user_id))
    else:
        query = query.where(Job.user_id == current_user.id)

    result = await db.execute(query)
    jobs = result.scalars().all()

    buckets: dict[str, list[Job]] = {s.value: [] for s in ApplicationStatus}
    for job in jobs:
        buckets[job.status.value].append(job)

    return buckets


async def get_history(
    db: AsyncSession,
    job_id: int,
    current_user: User,
) -> list[StatusHistory] | None:
    job = await _load_job(db, job_id)
    if job is None or not _can_access(job, current_user):
        return None

    result = await db.execute(
        select(StatusHistory)
        .where(StatusHistory.job_id == job_id)
        .order_by(StatusHistory.changed_at.asc())
    )
    return list(result.scalars().all())
