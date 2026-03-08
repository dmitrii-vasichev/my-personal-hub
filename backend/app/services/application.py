from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy import asc, desc, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.job import Application, ApplicationStatus, Job, StatusHistory
from app.models.user import User, UserRole
from app.schemas.application import ApplicationCreate, ApplicationStatusChange, ApplicationUpdate


class DuplicateApplicationError(Exception):
    """Raised when an application already exists for the given job and user."""
    pass


def _can_access(application: Application, user: User) -> bool:
    """Return True if user may read or write this application."""
    if user.role == UserRole.admin:
        return True
    return application.user_id == user.id


async def _load_application(db: AsyncSession, application_id: int) -> Application | None:
    """Load application by id with job and status_history eagerly loaded."""
    result = await db.execute(
        select(Application)
        .where(Application.id == application_id)
        .options(
            selectinload(Application.job),
            selectinload(Application.status_history),
        )
    )
    return result.scalar_one_or_none()


# ── CRUD ──────────────────────────────────────────────────────────────────────


async def create_application(
    db: AsyncSession,
    data: ApplicationCreate,
    current_user: User,
) -> Application:
    # Verify job exists and belongs to this user (or user is admin)
    job_result = await db.execute(select(Job).where(Job.id == data.job_id))
    job = job_result.scalar_one_or_none()
    if job is None or not (
        current_user.role == UserRole.admin or job.user_id == current_user.id
    ):
        return None  # type: ignore[return-value]

    # Check for existing application
    existing = await db.execute(
        select(Application).where(
            Application.job_id == data.job_id,
            Application.user_id == current_user.id
        )
    )
    if existing.scalars().first():
        raise DuplicateApplicationError()

    application = Application(
        user_id=current_user.id,
        job_id=data.job_id,
        status=data.status,
        applied_date=date.today() if data.status == ApplicationStatus.applied else None,
    )
    db.add(application)
    await db.flush()  # Get application.id before creating history entry

    # Create initial status history entry
    history_entry = StatusHistory(
        application_id=application.id,
        old_status=None,
        new_status=data.status.value,
        comment=None,
    )
    db.add(history_entry)

    await db.commit()
    return await _load_application(db, application.id)  # type: ignore[return-value]


async def get_application(
    db: AsyncSession,
    application_id: int,
    current_user: User,
) -> Application | None:
    application = await _load_application(db, application_id)
    if application is None:
        return None
    if not _can_access(application, current_user):
        return None
    return application


async def update_application(
    db: AsyncSession,
    application_id: int,
    data: ApplicationUpdate,
    current_user: User,
) -> Application | None:
    application = await _load_application(db, application_id)
    if application is None or not _can_access(application, current_user):
        return None

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(application, field, value)

    application.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return await _load_application(db, application_id)


async def delete_application(
    db: AsyncSession,
    application_id: int,
    current_user: User,
) -> bool:
    application = await _load_application(db, application_id)
    if application is None or not _can_access(application, current_user):
        return False
    await db.delete(application)
    await db.commit()
    return True


async def change_status(
    db: AsyncSession,
    application_id: int,
    data: ApplicationStatusChange,
    current_user: User,
) -> Application | None:
    application = await _load_application(db, application_id)
    if application is None or not _can_access(application, current_user):
        return None

    if data.new_status == application.status:
        return application  # no change needed, skip history entry

    old_status = application.status.value

    # Auto-set applied_date when transitioning to "applied"
    if data.new_status == ApplicationStatus.applied and application.applied_date is None:
        application.applied_date = date.today()

    application.status = data.new_status
    application.updated_at = datetime.now(timezone.utc)

    history_entry = StatusHistory(
        application_id=application.id,
        old_status=old_status,
        new_status=data.new_status.value,
        comment=data.comment,
    )
    db.add(history_entry)

    await db.commit()
    return await _load_application(db, application_id)


# ── Kanban / List / History ────────────────────────────────────────────────────


async def get_kanban(
    db: AsyncSession,
    current_user: User,
) -> dict[str, list[Application]]:
    """Return applications grouped by all 12 statuses for the kanban board."""
    query = select(Application).options(selectinload(Application.job))
    if current_user.role != UserRole.admin:
        query = query.where(Application.user_id == current_user.id)

    result = await db.execute(query)
    applications = result.scalars().all()

    # Initialise all 12 buckets so empty columns are always present
    buckets: dict[str, list[Application]] = {status.value: [] for status in ApplicationStatus}
    for app in applications:
        buckets[app.status.value].append(app)

    return buckets


async def list_applications(
    db: AsyncSession,
    current_user: User,
    status: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
) -> list[Application]:
    """List applications with optional filters and sorting."""
    query = select(Application).options(selectinload(Application.job))

    # Access control
    if current_user.role != UserRole.admin:
        query = query.where(Application.user_id == current_user.id)

    # Status filter: comma-separated values
    if status:
        status_values = [s.strip() for s in status.split(",") if s.strip()]
        if status_values:
            query = query.where(Application.status.in_(status_values))

    # Search filter: ILIKE on job.title and job.company
    if search:
        search_pattern = f"%{search}%"
        query = query.join(Application.job).where(
            or_(
                Job.title.ilike(search_pattern),
                Job.company.ilike(search_pattern),
            )
        )

    # Sorting
    _sortable_columns = {
        "created_at": Application.created_at,
        "updated_at": Application.updated_at,
        "applied_date": Application.applied_date,
        "next_action_date": Application.next_action_date,
    }
    sort_column = _sortable_columns.get(sort_by, Application.created_at)
    order_fn = asc if sort_order == "asc" else desc
    query = query.order_by(order_fn(sort_column))

    result = await db.execute(query)
    return list(result.scalars().all())


async def get_history(
    db: AsyncSession,
    application_id: int,
    current_user: User,
) -> list[StatusHistory] | None:
    """Return status history for an application ordered by changed_at ASC.

    Returns None when the application does not exist or the user lacks access.
    """
    application = await _load_application(db, application_id)
    if application is None or not _can_access(application, current_user):
        return None

    result = await db.execute(
        select(StatusHistory)
        .where(StatusHistory.application_id == application_id)
        .order_by(StatusHistory.changed_at.asc())
    )
    return list(result.scalars().all())
