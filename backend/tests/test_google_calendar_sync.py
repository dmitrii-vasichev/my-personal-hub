"""Regression tests for the Google Calendar pull path (D13).

Locks the invariant that a user-set ``CalendarEvent.job_id`` survives a
``_pull_events`` sweep that re-receives the same event from Google with
updated metadata. The field-by-field assignment in
``google_calendar._pull_events`` (around line 114) never touches
``job_id``; this test makes that guarantee load-bearing so any future
refactor that replaces the loop with a wholesale row replacement fails
CI.
"""
from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.models.calendar import CalendarEvent, EventSource
from app.models.user import User, UserRole
from app.services import google_calendar as gcal


def _user(user_id: int = 1) -> User:
    u = User()
    u.id = user_id
    u.role = UserRole.member
    u.email = f"user{user_id}@example.com"
    u.display_name = f"User {user_id}"
    return u


def _local_event(
    *,
    event_id: int = 10,
    user_id: int = 1,
    google_event_id: str = "g1",
    title: str = "Old title",
    job_id: int | None = 42,
) -> CalendarEvent:
    e = CalendarEvent()
    e.id = event_id
    e.user_id = user_id
    e.google_event_id = google_event_id
    e.title = title
    e.description = None
    e.start_time = datetime(2026, 5, 10, 10, 0, tzinfo=timezone.utc)
    e.end_time = datetime(2026, 5, 10, 11, 0, tzinfo=timezone.utc)
    e.location = None
    e.all_day = False
    e.source = EventSource.google
    e.job_id = job_id
    return e


@pytest.mark.asyncio
async def test_pull_events_preserves_user_set_job_id():
    """A re-pulled event keeps its user-set job_id even when Google
    returns new metadata that overwrites the other fields.
    """
    user = _user()
    local = _local_event(
        google_event_id="g1", title="Old title", job_id=42
    )

    google_payload = {
        "items": [
            {
                "id": "g1",
                "status": "confirmed",
                "summary": "New title from Google",
                "description": "Meeting notes",
                "location": "Zoom",
                "start": {"dateTime": "2026-05-10T14:00:00Z"},
                "end": {"dateTime": "2026-05-10T15:00:00Z"},
            }
        ]
    }

    # Google API client mock: service.events().list(...).execute() → payload.
    service = MagicMock()
    service.events.return_value.list.return_value.execute.return_value = (
        google_payload
    )

    # DB: every execute() returns a result whose scalar_one_or_none() is
    # the local event. _pull_events only calls execute() once per event
    # (via _find_by_google_id), so one shared mock is enough here.
    db = AsyncMock()
    exec_result = MagicMock()
    exec_result.scalar_one_or_none.return_value = local
    db.execute = AsyncMock(return_value=exec_result)
    db.commit = AsyncMock()
    db.add = MagicMock()
    db.delete = AsyncMock()

    pulled = await gcal._pull_events(db, user, service, "primary")

    # We matched an existing row, so this is an update path (pulled_count
    # counts new inserts only).
    assert pulled == 0
    assert local.title == "New title from Google"
    assert local.description == "Meeting notes"
    assert local.location == "Zoom"
    # The load-bearing invariant: user-set job_id survives the sync.
    assert local.job_id == 42
