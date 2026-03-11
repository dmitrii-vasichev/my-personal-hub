"""Tests for note-event link service."""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services.note_event_link import (
    link_note_event,
    unlink_note_event,
    get_note_linked_events,
    get_event_linked_notes,
)


def _make_user(uid=1):
    u = MagicMock()
    u.id = uid
    return u


def _make_note(nid=1):
    n = MagicMock()
    n.id = nid
    return n


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


# ── link_note_event ──────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_link_note_event_note_not_found():
    db = _db_returning(None)
    result = await link_note_event(db, note_id=1, event_id=10, user=_make_user())
    assert result is False


@pytest.mark.asyncio
async def test_link_note_event_event_not_found():
    note = _make_note()
    db = _db_returning(note, None)
    result = await link_note_event(db, note_id=1, event_id=10, user=_make_user())
    assert result is False


@pytest.mark.asyncio
async def test_link_note_event_success():
    note = _make_note()
    event = _make_event()
    db = _db_returning(note, event, None)

    result = await link_note_event(db, note_id=1, event_id=10, user=_make_user())
    assert result is True
    db.add.assert_called_once()
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_link_note_event_already_linked():
    note = _make_note()
    event = _make_event()
    existing_link = MagicMock()
    db = _db_returning(note, event, existing_link)

    result = await link_note_event(db, note_id=1, event_id=10, user=_make_user())
    assert result is True
    db.add.assert_not_called()


# ── unlink_note_event ────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_unlink_note_event_note_not_found():
    db = _db_returning(None)
    result = await unlink_note_event(db, note_id=99, event_id=10, user=_make_user())
    assert result is False


@pytest.mark.asyncio
async def test_unlink_note_event_success():
    note = _make_note()
    db = _db_returning(note, None)  # note lookup + delete execute

    result = await unlink_note_event(db, note_id=1, event_id=10, user=_make_user())
    assert result is True
    db.commit.assert_awaited_once()


# ── get_note_linked_events ───────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_note_linked_events_note_not_found():
    db = _db_returning(None)
    result = await get_note_linked_events(db, note_id=99, user=_make_user())
    assert result is None


@pytest.mark.asyncio
async def test_get_note_linked_events_returns_list():
    note = _make_note()
    event = _make_event()
    db = _db_returning(note, [event])

    events = await get_note_linked_events(db, note_id=1, user=_make_user())
    assert events == [event]


# ── get_event_linked_notes ───────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_event_linked_notes_event_not_found():
    db = _db_returning(None)
    result = await get_event_linked_notes(db, event_id=99, user=_make_user())
    assert result is None


@pytest.mark.asyncio
async def test_get_event_linked_notes_returns_list():
    event = _make_event()
    note = _make_note()
    db = _db_returning(event, [note])

    notes = await get_event_linked_notes(db, event_id=10, user=_make_user())
    assert notes == [note]
