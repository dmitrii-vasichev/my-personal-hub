"""Unit tests for the D13 backfill script.

Exercises ``run_backfill(session_factory)`` with mocked async sessions.
State is tracked in-memory on the mock ``CalendarEvent`` objects so
assertions can verify the script both sets ``job_id`` on clean matches
and leaves it untouched on ambiguous / no-match inputs.

Idempotence (re-run on already-linked data) is verified live in the
script's docstring smoke run — the SQL filter ``WHERE job_id IS NULL``
makes it structurally impossible to re-touch a linked event. Test 2
below covers the underlying invariant.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.models.calendar import CalendarEvent, EventSource
from app.models.job import ApplicationStatus, Job
from app.models.task import Visibility
from app.models.user import User, UserRole
from scripts.backfill_job_event_links import run_backfill


# ── Mock helpers ──────────────────────────────────────────────────────────────


def _user(user_id: int = 1) -> User:
    u = User()
    u.id = user_id
    u.role = UserRole.member
    u.email = f"user{user_id}@example.com"
    u.display_name = f"User {user_id}"
    return u


def _event(
    *,
    event_id: int = 10,
    user_id: int = 1,
    title: str = "Interview with Acme",
    job_id: Optional[int] = None,
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
    e.job_id = job_id
    return e


def _job(
    *,
    job_id: int = 1,
    user_id: int = 1,
    company: str = "Acme",
    status: Optional[ApplicationStatus] = ApplicationStatus.applied,
) -> Job:
    j = Job()
    j.id = job_id
    j.user_id = user_id
    j.title = "Senior Engineer"
    j.company = company
    j.status = status
    return j


def _scalars_result(items: list):
    """Result shape for ``(await db.execute(...)).scalars().all()``."""
    r = MagicMock()
    r.scalars.return_value.all.return_value = items
    return r


def _session_factory(db: AsyncMock):
    """Callable that mimics ``async_sessionmaker`` — returns an async
    context manager yielding ``db``.
    """
    cm = MagicMock()
    cm.__aenter__ = AsyncMock(return_value=db)
    cm.__aexit__ = AsyncMock(return_value=None)
    factory = MagicMock(return_value=cm)
    return factory


# ── Tests ─────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_backfill_links_single_match():
    """One user, one unlinked event with a single company-name match →
    ``event.job_id`` set and summary reports ``matched: 1``.
    """
    user = _user()
    event = _event(title="Interview with Acme", job_id=None)
    job = _job(job_id=7, company="Acme")

    db = AsyncMock()
    db.execute = AsyncMock(
        side_effect=[
            _scalars_result([user]),   # SELECT User
            _scalars_result([event]),  # SELECT events WHERE job_id IS NULL
            _scalars_result([job]),    # SELECT Job (inside _find_hint_candidates)
        ]
    )
    db.commit = AsyncMock()

    totals = await run_backfill(_session_factory(db))

    assert event.job_id == 7
    assert totals == {
        "users": 1,
        "scanned": 1,
        "matched": 1,
        "ambiguous": 0,
        "no_match": 0,
    }
    db.commit.assert_awaited()


@pytest.mark.asyncio
async def test_backfill_skips_already_linked_events():
    """Events with ``job_id`` set are excluded by the SQL scope —
    they never reach the Python loop. The linked event is invisible
    to ``run_backfill``; only its absence from the events query is
    observable.
    """
    user = _user()

    db = AsyncMock()
    db.execute = AsyncMock(
        side_effect=[
            _scalars_result([user]),  # SELECT User
            _scalars_result([]),      # SQL-scoped events → empty
        ]
    )
    db.commit = AsyncMock()

    totals = await run_backfill(_session_factory(db))

    assert totals == {
        "users": 1,
        "scanned": 0,
        "matched": 0,
        "ambiguous": 0,
        "no_match": 0,
    }


@pytest.mark.asyncio
async def test_backfill_leaves_ambiguous_unchanged():
    """Event title matches two active jobs → ``job_id`` stays NULL and
    ``ambiguous`` count ticks.
    """
    user = _user()
    event = _event(title="Acme / Globex joint sync", job_id=None)
    j1 = _job(job_id=1, company="Acme")
    j2 = _job(job_id=2, company="Globex")

    db = AsyncMock()
    db.execute = AsyncMock(
        side_effect=[
            _scalars_result([user]),
            _scalars_result([event]),
            _scalars_result([j1, j2]),
        ]
    )
    db.commit = AsyncMock()

    totals = await run_backfill(_session_factory(db))

    assert event.job_id is None
    assert totals["ambiguous"] == 1
    assert totals["matched"] == 0


@pytest.mark.asyncio
async def test_backfill_no_match_counts():
    """Event title matches no active job → ``job_id`` stays NULL and
    ``no_match`` count ticks.
    """
    user = _user()
    event = _event(title="Lunch with parents", job_id=None)
    # One unrelated job in the user's list.
    job = _job(company="Unrelated Co")

    db = AsyncMock()
    db.execute = AsyncMock(
        side_effect=[
            _scalars_result([user]),
            _scalars_result([event]),
            _scalars_result([job]),
        ]
    )
    db.commit = AsyncMock()

    totals = await run_backfill(_session_factory(db))

    assert event.job_id is None
    assert totals["no_match"] == 1
    assert totals["matched"] == 0
