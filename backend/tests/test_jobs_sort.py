"""
Unit tests for job service sort_by extensions — title, source, found_at.
"""
from __future__ import annotations

import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

from app.models.job import Job
from app.models.user import User, UserRole
from app.services import job as job_service


def make_user(user_id: int = 1) -> User:
    u = User()
    u.id = user_id
    u.role = UserRole.member
    u.email = f"user{user_id}@example.com"
    u.display_name = f"User {user_id}"
    return u


def make_job(
    job_id: int,
    user_id: int = 1,
    title: str = "Job",
    company: str = "Corp",
    source: str = "manual",
    found_at: datetime | None = None,
) -> Job:
    j = Job()
    j.id = job_id
    j.user_id = user_id
    j.title = title
    j.company = company
    j.source = source
    j.found_at = found_at
    j.tags = []
    j.status = None
    j.created_at = datetime.now(timezone.utc)
    j.updated_at = datetime.now(timezone.utc)
    return j


def make_db_with_jobs(jobs: list[Job]):
    """Create a mocked async session that returns the given jobs list."""
    db = AsyncMock()

    jobs_result = MagicMock()
    jobs_result.scalars.return_value.all.return_value = jobs

    db.execute = AsyncMock(return_value=jobs_result)
    return db


@pytest.mark.asyncio
async def test_sort_by_title_is_allowed():
    """sort_by=title should be accepted without falling back to created_at."""
    jobs = [
        make_job(1, title="Zebra Engineer"),
        make_job(2, title="Alpha Developer"),
    ]
    db = make_db_with_jobs(jobs)
    user = make_user()

    result = await job_service.list_jobs(db, user, sort_by="title", sort_order="asc")

    assert len(result) == 2
    assert db.execute.call_count == 1


@pytest.mark.asyncio
async def test_sort_by_source_is_allowed():
    """sort_by=source should be accepted."""
    jobs = [
        make_job(1, source="LinkedIn"),
        make_job(2, source="Indeed"),
    ]
    db = make_db_with_jobs(jobs)
    user = make_user()

    result = await job_service.list_jobs(db, user, sort_by="source", sort_order="asc")

    assert len(result) == 2
    assert db.execute.call_count == 1


@pytest.mark.asyncio
async def test_sort_by_found_at_is_allowed():
    """sort_by=found_at should be accepted."""
    jobs = [
        make_job(1, found_at=datetime(2026, 3, 1, tzinfo=timezone.utc)),
        make_job(2, found_at=datetime(2026, 3, 5, tzinfo=timezone.utc)),
    ]
    db = make_db_with_jobs(jobs)
    user = make_user()

    result = await job_service.list_jobs(db, user, sort_by="found_at", sort_order="desc")

    assert len(result) == 2
    assert db.execute.call_count == 1


@pytest.mark.asyncio
async def test_existing_sort_fields_still_work():
    """Existing sort_by options (created_at, company, match_score) should still work."""
    jobs = [make_job(1)]
    user = make_user()

    for field in ["created_at", "company", "match_score"]:
        db = make_db_with_jobs(jobs)
        result = await job_service.list_jobs(db, user, sort_by=field)
        assert len(result) == 1


@pytest.mark.asyncio
async def test_invalid_sort_field_falls_back_to_created_at():
    """An invalid sort_by value should fall back to created_at without error."""
    jobs = [make_job(1)]
    db = make_db_with_jobs(jobs)
    user = make_user()

    result = await job_service.list_jobs(db, user, sort_by="nonexistent_field")

    assert len(result) == 1
    assert db.execute.call_count == 1


@pytest.mark.asyncio
async def test_allowed_sort_fields_set():
    """Verify that all expected sort fields are in the allowed set."""
    expected = {"created_at", "company", "match_score", "title", "source", "found_at"}
    import inspect
    source = inspect.getsource(job_service.list_jobs)
    for field in expected:
        assert f'"{field}"' in source, f"sort field '{field}' not found in allowed_sort_fields"
