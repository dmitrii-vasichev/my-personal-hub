"""Tests for note-task link service."""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services.note_task_link import (
    link_note_task,
    unlink_note_task,
    get_note_linked_tasks,
    get_task_linked_notes,
)


def _make_user(uid=1):
    u = MagicMock()
    u.id = uid
    return u


def _make_note(nid=1):
    n = MagicMock()
    n.id = nid
    return n


def _make_task(tid=10):
    t = MagicMock()
    t.id = tid
    t.user_id = 1
    return t


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


# ── link_note_task ───────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_link_note_task_note_not_found():
    db = _db_returning(None)
    result = await link_note_task(db, note_id=1, task_id=10, user=_make_user())
    assert result is False


@pytest.mark.asyncio
async def test_link_note_task_task_not_found():
    note = _make_note()
    db = _db_returning(note, None)
    result = await link_note_task(db, note_id=1, task_id=10, user=_make_user())
    assert result is False


@pytest.mark.asyncio
async def test_link_note_task_success():
    note = _make_note()
    task = _make_task()
    db = _db_returning(note, task, None)  # note, task, existing-link check

    result = await link_note_task(db, note_id=1, task_id=10, user=_make_user())
    assert result is True
    db.add.assert_called_once()
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_link_note_task_already_linked():
    note = _make_note()
    task = _make_task()
    existing_link = MagicMock()
    db = _db_returning(note, task, existing_link)

    result = await link_note_task(db, note_id=1, task_id=10, user=_make_user())
    assert result is True
    db.add.assert_not_called()


# ── unlink_note_task ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_unlink_note_task_note_not_found():
    db = _db_returning(None)
    result = await unlink_note_task(db, note_id=99, task_id=10, user=_make_user())
    assert result is False


@pytest.mark.asyncio
async def test_unlink_note_task_success():
    note = _make_note()
    task = _make_task()
    db = _db_returning(note, task, None, None)  # note, task, delete, primary-clear

    result = await unlink_note_task(db, note_id=1, task_id=10, user=_make_user())
    assert result is True
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_unlink_note_task_task_not_found():
    note = _make_note()
    db = _db_returning(note, None)
    result = await unlink_note_task(db, note_id=1, task_id=99, user=_make_user())
    assert result is False
    db.commit.assert_not_awaited()


# ── get_note_linked_tasks ────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_note_linked_tasks_note_not_found():
    db = _db_returning(None)
    result = await get_note_linked_tasks(db, note_id=99, user=_make_user())
    assert result is None


@pytest.mark.asyncio
async def test_get_note_linked_tasks_returns_list():
    note = _make_note()
    task = _make_task()
    db = _db_returning(note, [task])

    tasks = await get_note_linked_tasks(db, note_id=1, user=_make_user())
    assert tasks == [task]


# ── get_task_linked_notes ────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_task_linked_notes_task_not_found():
    db = _db_returning(None)
    result = await get_task_linked_notes(db, task_id=99, user=_make_user())
    assert result is None


@pytest.mark.asyncio
async def test_get_task_linked_notes_returns_list():
    task = _make_task()
    note = _make_note()
    db = _db_returning(task, [note])

    notes = await get_task_linked_notes(db, task_id=10, user=_make_user())
    assert notes == [note]
