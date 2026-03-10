"""Tests for merged job status, kanban, and history functionality."""
from __future__ import annotations

from datetime import date, datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.models.job import ApplicationStatus, Job, StatusHistory
from app.models.user import User, UserRole
from app.services import job as job_service
from app.schemas.job import JobStatusChange, JobTrackingUpdate


def make_user(user_id: int = 1) -> User:
    u = User()
    u.id = user_id
    u.role = UserRole.member
    u.email = f"user{user_id}@example.com"
    u.display_name = f"User {user_id}"
    return u


def make_job(
    job_id: int = 1,
    user_id: int = 1,
    status: ApplicationStatus | None = None,
) -> Job:
    j = Job()
    j.id = job_id
    j.user_id = user_id
    j.title = "Software Engineer"
    j.company = "TestCorp"
    j.location = "Remote"
    j.url = None
    j.source = "manual"
    j.description = "Test job description"
    j.salary_min = None
    j.salary_max = None
    j.salary_currency = "USD"
    j.match_score = None
    j.match_result = None
    j.tags = []
    j.found_at = None
    j.status = status
    j.notes = None
    j.recruiter_name = None
    j.recruiter_contact = None
    j.applied_date = None
    j.next_action = None
    j.next_action_date = None
    j.rejection_reason = None
    j.status_history = []
    j.created_at = datetime.now(timezone.utc)
    j.updated_at = datetime.now(timezone.utc)
    return j


def _db_load_job(job: Job | None):
    """Mock db for _load_job — single execute returning scalar_one_or_none."""
    db = AsyncMock()
    result = MagicMock()
    result.scalar_one_or_none.return_value = job
    db.execute = AsyncMock(return_value=result)
    return db


# ── change_status tests ──────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_change_status_success():
    """Changing status creates a history entry and updates the job."""
    job = make_job(status=ApplicationStatus.found)
    db = AsyncMock()

    # Two execute calls: _load_job, _load_job_with_history (for return)
    result1 = MagicMock()
    result1.scalar_one_or_none.return_value = job
    result2 = MagicMock()
    result2.scalar_one_or_none.return_value = job
    db.execute = AsyncMock(side_effect=[result1, result2])

    user = make_user()
    data = JobStatusChange(new_status=ApplicationStatus.applied)

    result = await job_service.change_status(db, 1, data, user)

    assert result is not None
    assert result.status == ApplicationStatus.applied
    assert result.applied_date == date.today()
    db.add.assert_called_once()  # StatusHistory entry
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_change_status_same_status_no_history():
    """Changing to same status skips history entry creation."""
    job = make_job(status=ApplicationStatus.applied)
    db = AsyncMock()

    # _load_job, then _load_job_with_history for return
    result1 = MagicMock()
    result1.scalar_one_or_none.return_value = job
    result2 = MagicMock()
    result2.scalar_one_or_none.return_value = job
    db.execute = AsyncMock(side_effect=[result1, result2])

    user = make_user()
    data = JobStatusChange(new_status=ApplicationStatus.applied)

    result = await job_service.change_status(db, 1, data, user)

    assert result is not None
    db.add.assert_not_called()


@pytest.mark.asyncio
async def test_change_status_job_not_found():
    """Returns None when job doesn't exist."""
    db = _db_load_job(None)
    user = make_user()
    data = JobStatusChange(new_status=ApplicationStatus.applied)

    result = await job_service.change_status(db, 999, data, user)
    assert result is None


@pytest.mark.asyncio
async def test_change_status_access_denied():
    """Returns None when user doesn't own the job."""
    job = make_job(user_id=1, status=ApplicationStatus.found)
    db = _db_load_job(job)
    user = make_user(user_id=2)
    data = JobStatusChange(new_status=ApplicationStatus.applied)

    result = await job_service.change_status(db, 1, data, user)
    assert result is None


# ── update_tracking tests ────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_update_tracking_success():
    """Updating tracking fields works correctly."""
    job = make_job(status=ApplicationStatus.applied)
    db = AsyncMock()

    result1 = MagicMock()
    result1.scalar_one_or_none.return_value = job
    result2 = MagicMock()
    result2.scalar_one_or_none.return_value = job
    db.execute = AsyncMock(side_effect=[result1, result2])

    user = make_user()
    data = JobTrackingUpdate(
        notes="Called recruiter",
        recruiter_name="Jane Doe",
    )

    result = await job_service.update_tracking(db, 1, data, user)

    assert result is not None
    assert result.notes == "Called recruiter"
    assert result.recruiter_name == "Jane Doe"


# ── get_kanban tests ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_kanban_groups_by_status():
    """Kanban groups jobs by their status."""
    jobs = [
        make_job(job_id=1, status=ApplicationStatus.applied),
        make_job(job_id=2, status=ApplicationStatus.applied),
        make_job(job_id=3, status=ApplicationStatus.screening),
    ]
    db = AsyncMock()
    result = MagicMock()
    result.scalars.return_value.all.return_value = jobs
    db.execute = AsyncMock(return_value=result)

    user = make_user()
    buckets = await job_service.get_kanban(db, user)

    assert len(buckets["applied"]) == 2
    assert len(buckets["screening"]) == 1
    assert len(buckets["found"]) == 0


@pytest.mark.asyncio
async def test_get_kanban_empty():
    """Kanban returns empty buckets when no tracked jobs exist."""
    db = AsyncMock()
    result = MagicMock()
    result.scalars.return_value.all.return_value = []
    db.execute = AsyncMock(return_value=result)

    user = make_user()
    buckets = await job_service.get_kanban(db, user)

    assert all(len(v) == 0 for v in buckets.values())
    assert len(buckets) == 12  # All 12 status columns present


# ── get_history tests ────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_history_success():
    """Returns status history for a job."""
    job = make_job()

    h1 = StatusHistory()
    h1.id = 1
    h1.job_id = 1
    h1.old_status = None
    h1.new_status = "found"
    h1.comment = None
    h1.changed_at = datetime.now(timezone.utc)

    db = AsyncMock()
    result1 = MagicMock()
    result1.scalar_one_or_none.return_value = job
    result2 = MagicMock()
    result2.scalars.return_value.all.return_value = [h1]
    db.execute = AsyncMock(side_effect=[result1, result2])

    user = make_user()
    history = await job_service.get_history(db, 1, user)

    assert history is not None
    assert len(history) == 1
    assert history[0].new_status == "found"


@pytest.mark.asyncio
async def test_get_history_job_not_found():
    """Returns None when job doesn't exist."""
    db = _db_load_job(None)
    user = make_user()

    result = await job_service.get_history(db, 999, user)
    assert result is None


# ── Access control ───────────────────────────────────────────────────────────


class TestJobAccessControl:
    def test_owner_can_access(self):
        user = make_user(user_id=1)
        job = make_job(user_id=1)
        assert job_service._can_access(job, user) is True

    def test_other_cannot_access(self):
        user = make_user(user_id=2)
        job = make_job(user_id=1)
        assert job_service._can_access(job, user) is False

    def test_admin_can_access_any(self):
        admin = make_user(user_id=99)
        admin.role = UserRole.admin
        job = make_job(user_id=1)
        assert job_service._can_access(job, admin) is True
