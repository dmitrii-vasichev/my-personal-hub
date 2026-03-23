"""Tests for task-event link service."""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services.task_event_link import (
    link_task_event,
    unlink_task_event,
    get_linked_events,
    get_linked_tasks,
)


def _make_user(uid=1):
    u = MagicMock()
    u.id = uid
    return u


def _make_task(tid=1):
    t = MagicMock()
    t.id = tid
    return t


def _make_event(eid=10):
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


@pytest.mark.asyncio
async def test_link_task_event_task_not_found():
    """Returns False when task does not belong to user."""
    db = _db_returning(None)  # task query returns None
    user = _make_user()

    result = await link_task_event(db, task_id=1, event_id=10, user=user)
    assert result is False


@pytest.mark.asyncio
async def test_link_task_event_success():
    """Links task to event and commits."""
    task = _make_task()
    event = _make_event()
    # calls: _get_task, _get_event, existing-link check
    db = _db_returning(task, event, None)

    result = await link_task_event(db, task_id=1, event_id=10, user=_make_user())
    assert result is True
    db.add.assert_called_once()
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_link_task_event_already_linked():
    """Returns True without adding a duplicate row."""
    task = _make_task()
    event = _make_event()
    existing_link = MagicMock()  # link already exists
    db = _db_returning(task, event, existing_link)

    result = await link_task_event(db, task_id=1, event_id=10, user=_make_user())
    assert result is True
    db.add.assert_not_called()


@pytest.mark.asyncio
async def test_unlink_task_event_task_not_found():
    """Returns False when task does not exist."""
    db = _db_returning(None)
    result = await unlink_task_event(db, task_id=99, event_id=10, user=_make_user())
    assert result is False


@pytest.mark.asyncio
async def test_get_linked_events_returns_list():
    """Returns list of events linked to a task."""
    task = _make_task()
    event = _make_event()
    db = _db_returning(task, [event])

    events = await get_linked_events(db, task_id=1, user=_make_user())
    assert events == [event]


@pytest.mark.asyncio
async def test_get_linked_tasks_event_not_found():
    """Returns None when event not found."""
    db = _db_returning(None)
    result = await get_linked_tasks(db, event_id=99, user=_make_user())
    assert result is None
