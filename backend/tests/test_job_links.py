"""Tests for job-event link services."""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services.job_event_link import (
    link_job_event,
    unlink_job_event,
    get_job_linked_events,
)


def _make_user(uid=1):
    u = MagicMock()
    u.id = uid
    return u


def _make_job(jid=1):
    j = MagicMock()
    j.id = jid
    return j


def _make_event(eid=20):
    e = MagicMock()
    e.id = eid
    return e


def _db_returning(*values):
    """Build a mock db where each execute() call returns the next value."""
    db = AsyncMock()
    results = []
    for v in values:
        r = MagicMock()
        if isinstance(v, list):
            r.scalars.return_value.all.return_value = v
        else:
            r.scalar_one_or_none.return_value = v
        results.append(r)
    db.execute = AsyncMock(side_effect=results)
    return db


# ── Job-Event linking ────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_link_job_event_job_not_found():
    """Returns False when job does not belong to user."""
    db = _db_returning(None)
    result = await link_job_event(db, job_id=1, event_id=20, user=_make_user())
    assert result is False


@pytest.mark.asyncio
async def test_link_job_event_event_not_found():
    """Returns False when event does not belong to user."""
    job = _make_job()
    db = _db_returning(job, None)
    result = await link_job_event(db, job_id=1, event_id=20, user=_make_user())
    assert result is False


@pytest.mark.asyncio
async def test_link_job_event_success():
    """Links event to job and commits."""
    job = _make_job()
    event = _make_event()
    db = _db_returning(job, event, None)

    result = await link_job_event(db, job_id=1, event_id=20, user=_make_user())
    assert result is True
    db.add.assert_called_once()
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_link_job_event_already_linked():
    """Returns True without adding a duplicate (idempotent)."""
    job = _make_job()
    event = _make_event()
    existing_link = MagicMock()
    db = _db_returning(job, event, existing_link)

    result = await link_job_event(db, job_id=1, event_id=20, user=_make_user())
    assert result is True
    db.add.assert_not_called()


@pytest.mark.asyncio
async def test_unlink_job_event_job_not_found():
    """Returns False when job does not exist."""
    db = _db_returning(None)
    result = await unlink_job_event(db, job_id=99, event_id=20, user=_make_user())
    assert result is False


@pytest.mark.asyncio
async def test_get_job_linked_events_returns_list():
    """Returns list of events linked to a job."""
    job = _make_job()
    event = _make_event()
    db = _db_returning(job, [event])

    events = await get_job_linked_events(db, job_id=1, user=_make_user())
    assert events == [event]


@pytest.mark.asyncio
async def test_get_job_linked_events_job_not_found():
    """Returns None when job not found."""
    db = _db_returning(None)
    result = await get_job_linked_events(db, job_id=99, user=_make_user())
    assert result is None
