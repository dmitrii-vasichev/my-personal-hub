"""Unit tests for ``suggest_job_for_event`` (D13).

Covers the substring-match hint rule, 404 paths, and the demo-role
smoke check. Matches the mock-based style of ``test_calendar.py`` —
these tests don't hit a real DB. The SQL-side filter
(``Job.status.notin_(TERMINAL_JOB_STATUSES)``) is trusted; tests that
depend on it either feed the mock an empty list (simulating SQL
filtered the row out) or assert behavior on the post-SQL list.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from app.models.calendar import CalendarEvent, EventSource
from app.models.job import ApplicationStatus, Job
from app.models.visibility import Visibility
from app.models.user import User, UserRole
from app.services import calendar as calendar_service


# ── Factories ─────────────────────────────────────────────────────────────────


def _user(user_id: int = 1, role: UserRole = UserRole.member) -> User:
    u = User()
    u.id = user_id
    u.role = role
    u.email = f"user{user_id}@example.com"
    u.display_name = f"User {user_id}"
    return u


def _event(
    *,
    event_id: int = 10,
    user_id: int = 1,
    title: str = "Interview with Acme",
) -> CalendarEvent:
    e = CalendarEvent()
    e.id = event_id
    e.user_id = user_id
    e.title = title
    e.description = None
    e.start_time = datetime(2026, 5, 1, 10, 0, tzinfo=timezone.utc)
    e.end_time = datetime(2026, 5, 1, 11, 0, tzinfo=timezone.utc)
    e.location = None
    e.all_day = False
    e.source = EventSource.local
    e.google_event_id = None
    e.visibility = Visibility.family
    e.job_id = None
    return e


def _job(
    *,
    job_id: int = 1,
    user_id: int = 1,
    title: str = "Senior Engineer",
    company: str = "Acme",
    status: Optional[ApplicationStatus] = ApplicationStatus.applied,
) -> Job:
    j = Job()
    j.id = job_id
    j.user_id = user_id
    j.title = title
    j.company = company
    j.status = status
    return j


def _event_result(event: Optional[CalendarEvent]) -> MagicMock:
    """Scalar result for the SELECT CalendarEvent query."""
    m = MagicMock()
    m.scalar_one_or_none.return_value = event
    return m


def _jobs_result(jobs: list[Job]) -> MagicMock:
    """Scalars result for the SELECT Job query inside
    ``_find_hint_candidates``.
    """
    m = MagicMock()
    m.scalars.return_value.all.return_value = jobs
    return m


# ── Tests ─────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
class TestSuggestJobForEvent:
    async def test_single_active_match_returns_hint(self):
        user = _user()
        event = _event(title="Interview with Acme — onsite")
        job = _job(job_id=7, company="Acme", status=ApplicationStatus.applied)

        db = AsyncMock()
        db.execute = AsyncMock(
            side_effect=[_event_result(event), _jobs_result([job])]
        )

        resp = await calendar_service.suggest_job_for_event(db, 10, user)
        assert resp.suggested_job_id == 7
        assert resp.match_reason == "substring"
        assert resp.job is not None
        assert resp.job.id == 7
        assert resp.job.company == "Acme"

    async def test_no_matching_job_returns_null(self):
        user = _user()
        event = _event(title="Lunch with parents")
        # One job exists but its company isn't in the title.
        job = _job(company="Acme", status=ApplicationStatus.applied)

        db = AsyncMock()
        db.execute = AsyncMock(
            side_effect=[_event_result(event), _jobs_result([job])]
        )

        resp = await calendar_service.suggest_job_for_event(db, 10, user)
        assert resp.suggested_job_id is None
        assert resp.match_reason is None
        assert resp.job is None

    async def test_two_active_matches_returns_null_ambiguous(self):
        user = _user()
        event = _event(title="Acme / Globex sync")
        j1 = _job(
            job_id=1, company="Acme", status=ApplicationStatus.applied
        )
        j2 = _job(
            job_id=2, company="Globex", status=ApplicationStatus.screening
        )

        db = AsyncMock()
        db.execute = AsyncMock(
            side_effect=[_event_result(event), _jobs_result([j1, j2])]
        )

        resp = await calendar_service.suggest_job_for_event(db, 10, user)
        assert resp.suggested_job_id is None
        assert resp.job is None

    async def test_terminal_status_job_is_filtered_out_by_sql(self):
        """SQL filter excludes terminal-status jobs before Python sees
        them. The mock simulates that by returning an empty list when
        all matching jobs are terminal.
        """
        user = _user()
        event = _event(title="Interview with Acme")

        db = AsyncMock()
        # Mock returns [] — SQL filter removed the rejected Acme job.
        db.execute = AsyncMock(
            side_effect=[_event_result(event), _jobs_result([])]
        )

        resp = await calendar_service.suggest_job_for_event(db, 10, user)
        assert resp.suggested_job_id is None

    async def test_case_insensitive_substring_match(self):
        user = _user()
        event = _event(title="INTERVIEW WITH acme CORP")
        job = _job(company="Acme", status=ApplicationStatus.screening)

        db = AsyncMock()
        db.execute = AsyncMock(
            side_effect=[_event_result(event), _jobs_result([job])]
        )

        resp = await calendar_service.suggest_job_for_event(db, 10, user)
        assert resp.suggested_job_id == job.id

    async def test_nonexistent_event_raises_404(self):
        user = _user()
        db = AsyncMock()
        db.execute = AsyncMock(return_value=_event_result(None))

        with pytest.raises(HTTPException) as exc:
            await calendar_service.suggest_job_for_event(db, 999, user)
        assert exc.value.status_code == 404

    async def test_other_users_event_raises_404(self):
        """SELECT scopes on user_id; mismatch returns None → 404. The
        event object from the simulated query is None even though a row
        exists, because the WHERE clause excluded it.
        """
        user = _user(user_id=1)
        db = AsyncMock()
        # Simulate "no row where id=10 AND user_id=1" — event belongs
        # to user 2.
        db.execute = AsyncMock(return_value=_event_result(None))

        with pytest.raises(HTTPException) as exc:
            await calendar_service.suggest_job_for_event(db, 10, user)
        assert exc.value.status_code == 404

    async def test_demo_user_can_call(self):
        """Service layer has no role gate — only ownership. Demo users
        reach the same code path as members.
        """
        user = _user(user_id=5, role=UserRole.demo)
        event = _event(event_id=10, user_id=5, title="Interview with Acme")
        job = _job(
            job_id=3,
            user_id=5,
            company="Acme",
            status=ApplicationStatus.applied,
        )

        db = AsyncMock()
        db.execute = AsyncMock(
            side_effect=[_event_result(event), _jobs_result([job])]
        )

        resp = await calendar_service.suggest_job_for_event(db, 10, user)
        assert resp.suggested_job_id == 3
