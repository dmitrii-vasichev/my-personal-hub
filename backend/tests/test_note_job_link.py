"""Tests for note-job link service."""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services.note_job_link import (
    link_note_job,
    unlink_note_job,
    get_note_linked_jobs,
    get_job_linked_notes,
)


def _make_user(uid=1):
    u = MagicMock()
    u.id = uid
    return u


def _make_note(nid=1):
    n = MagicMock()
    n.id = nid
    return n


def _make_job(jid=10):
    j = MagicMock()
    j.id = jid
    return j


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


# ── link_note_job ────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_link_note_job_note_not_found():
    db = _db_returning(None)
    result = await link_note_job(db, note_id=1, job_id=10, user=_make_user())
    assert result is False


@pytest.mark.asyncio
async def test_link_note_job_job_not_found():
    note = _make_note()
    db = _db_returning(note, None)
    result = await link_note_job(db, note_id=1, job_id=10, user=_make_user())
    assert result is False


@pytest.mark.asyncio
async def test_link_note_job_success():
    note = _make_note()
    job = _make_job()
    db = _db_returning(note, job, None)

    result = await link_note_job(db, note_id=1, job_id=10, user=_make_user())
    assert result is True
    db.add.assert_called_once()
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_link_note_job_already_linked():
    note = _make_note()
    job = _make_job()
    existing_link = MagicMock()
    db = _db_returning(note, job, existing_link)

    result = await link_note_job(db, note_id=1, job_id=10, user=_make_user())
    assert result is True
    db.add.assert_not_called()


# ── unlink_note_job ──────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_unlink_note_job_note_not_found():
    db = _db_returning(None)
    result = await unlink_note_job(db, note_id=99, job_id=10, user=_make_user())
    assert result is False


@pytest.mark.asyncio
async def test_unlink_note_job_success():
    note = _make_note()
    db = _db_returning(note, None)  # note lookup + delete execute

    result = await unlink_note_job(db, note_id=1, job_id=10, user=_make_user())
    assert result is True
    db.commit.assert_awaited_once()


# ── get_note_linked_jobs ─────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_note_linked_jobs_note_not_found():
    db = _db_returning(None)
    result = await get_note_linked_jobs(db, note_id=99, user=_make_user())
    assert result is None


@pytest.mark.asyncio
async def test_get_note_linked_jobs_returns_list():
    note = _make_note()
    job = _make_job()
    db = _db_returning(note, [job])

    jobs = await get_note_linked_jobs(db, note_id=1, user=_make_user())
    assert jobs == [job]


# ── get_job_linked_notes ─────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_job_linked_notes_job_not_found():
    db = _db_returning(None)
    result = await get_job_linked_notes(db, job_id=99, user=_make_user())
    assert result is None


@pytest.mark.asyncio
async def test_get_job_linked_notes_returns_list():
    job = _make_job()
    note = _make_note()
    db = _db_returning(job, [note])

    notes = await get_job_linked_notes(db, job_id=10, user=_make_user())
    assert notes == [note]
