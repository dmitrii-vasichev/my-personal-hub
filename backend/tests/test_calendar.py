"""
Unit tests for calendar service — testing business logic with mocked DB.
"""
import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from app.models.calendar import CalendarEvent, EventNote, EventSource
from app.models.user import User, UserRole
from app.schemas.calendar import CalendarEventCreate, CalendarEventUpdate, EventNoteCreate, EventNoteUpdate
from app.services import calendar as calendar_service


# ── Fixtures ──────────────────────────────────────────────────────────────────


def make_user(role: UserRole = UserRole.member, user_id: int = 1) -> User:
    u = User()
    u.id = user_id
    u.role = role
    u.email = f"user{user_id}@example.com"
    u.display_name = f"User {user_id}"
    return u


def make_event(user_id: int = 1, event_id: int = 10) -> CalendarEvent:
    e = CalendarEvent()
    e.id = event_id
    e.user_id = user_id
    e.title = "Test Event"
    e.description = None
    e.start_time = datetime(2026, 3, 15, 10, 0, tzinfo=timezone.utc)
    e.end_time = datetime(2026, 3, 15, 11, 0, tzinfo=timezone.utc)
    e.location = None
    e.all_day = False
    e.source = EventSource.local
    e.google_event_id = None
    e.notes = []
    return e


def make_note(event_id: int = 10, note_id: int = 1, user_id: int = 1) -> EventNote:
    n = EventNote()
    n.id = note_id
    n.event_id = event_id
    n.user_id = user_id
    n.content = "Test note content"
    return n


# ── Access control tests ──────────────────────────────────────────────────────


class TestAccessControl:
    def test_user_can_access_own_event(self):
        user = make_user(user_id=1)
        event = make_event(user_id=1)
        assert calendar_service._can_access_event(event, user) is True

    def test_user_cannot_access_others_event(self):
        user = make_user(user_id=1)
        event = make_event(user_id=2)
        assert calendar_service._can_access_event(event, user) is False

    def test_admin_can_access_any_event(self):
        admin = make_user(role=UserRole.admin, user_id=99)
        event = make_event(user_id=1)
        assert calendar_service._can_access_event(event, admin) is True


# ── Event CRUD tests ──────────────────────────────────────────────────────────


@pytest.mark.asyncio
class TestCalendarEventCRUD:
    async def test_create_event(self):
        db = AsyncMock()
        db.add = MagicMock()
        db.commit = AsyncMock()
        db.refresh = AsyncMock()

        user = make_user()
        data = CalendarEventCreate(
            title="Team Meeting",
            start_time=datetime(2026, 3, 20, 14, 0, tzinfo=timezone.utc),
            end_time=datetime(2026, 3, 20, 15, 0, tzinfo=timezone.utc),
        )

        # refresh sets the id on the event
        async def mock_refresh(obj):
            obj.id = 42
            obj.notes = []

        db.refresh.side_effect = mock_refresh

        event = await calendar_service.create_event(db, data, user)

        db.add.assert_called_once()
        db.commit.assert_awaited_once()
        assert event.title == "Team Meeting"
        assert event.user_id == user.id

    async def test_get_event_returns_none_for_wrong_user(self):
        db = AsyncMock()
        event = make_event(user_id=2, event_id=10)

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = event
        db.execute = AsyncMock(return_value=mock_result)

        user = make_user(user_id=1)  # different user
        result = await calendar_service.get_event(db, 10, user)
        assert result is None

    async def test_get_event_returns_event_for_owner(self):
        db = AsyncMock()
        event = make_event(user_id=1, event_id=10)

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = event
        db.execute = AsyncMock(return_value=mock_result)

        user = make_user(user_id=1)
        result = await calendar_service.get_event(db, 10, user)
        assert result == event

    async def test_delete_event_returns_false_for_wrong_user(self):
        db = AsyncMock()
        event = make_event(user_id=2, event_id=10)

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = event
        db.execute = AsyncMock(return_value=mock_result)

        user = make_user(user_id=1)
        result = await calendar_service.delete_event(db, 10, user)
        assert result is False

    async def test_delete_event_returns_true_for_owner(self):
        db = AsyncMock()
        event = make_event(user_id=1, event_id=10)

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = event
        db.execute = AsyncMock(return_value=mock_result)
        db.delete = AsyncMock()
        db.commit = AsyncMock()

        user = make_user(user_id=1)
        result = await calendar_service.delete_event(db, 10, user)
        assert result is True
        db.delete.assert_called_once_with(event)

    async def test_update_event_not_found(self):
        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        db.execute = AsyncMock(return_value=mock_result)

        user = make_user()
        result = await calendar_service.update_event(db, 999, CalendarEventUpdate(title="New"), user)
        assert result is None

    async def test_list_events_date_range(self):
        db = AsyncMock()
        events = [make_event(user_id=1, event_id=1), make_event(user_id=1, event_id=2)]

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = events
        db.execute = AsyncMock(return_value=mock_result)

        user = make_user()
        start = datetime(2026, 3, 1, tzinfo=timezone.utc)
        end = datetime(2026, 3, 31, tzinfo=timezone.utc)
        result = await calendar_service.list_events(db, user, start=start, end=end)
        assert len(result) == 2


# ── Event Notes tests ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
class TestEventNotes:
    async def test_create_note_returns_none_if_event_not_found(self):
        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        db.execute = AsyncMock(return_value=mock_result)

        user = make_user(user_id=1)
        result = await calendar_service.create_note(db, 999, EventNoteCreate(content="note"), user)
        assert result is None

    async def test_update_note_requires_owner(self):
        db = AsyncMock()
        note = make_note(user_id=2)  # owned by user 2

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = note
        db.execute = AsyncMock(return_value=mock_result)

        user = make_user(user_id=1)  # different user
        result = await calendar_service.update_note(db, 1, EventNoteUpdate(content="new"), user)
        assert result is None

    async def test_admin_can_update_any_note(self):
        db = AsyncMock()
        note = make_note(user_id=1)

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = note
        db.execute = AsyncMock(return_value=mock_result)
        db.commit = AsyncMock()
        db.refresh = AsyncMock()

        admin = make_user(role=UserRole.admin, user_id=99)
        result = await calendar_service.update_note(db, 1, EventNoteUpdate(content="updated"), admin)
        # Result is the note (refresh is a no-op mock)
        assert result is not None

    async def test_delete_note_requires_owner(self):
        db = AsyncMock()
        note = make_note(user_id=2)

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = note
        db.execute = AsyncMock(return_value=mock_result)

        user = make_user(user_id=1)
        result = await calendar_service.delete_note(db, 1, user)
        assert result is False


# ── Schema validation tests ───────────────────────────────────────────────────


class TestSchemas:
    def test_calendar_event_create_valid(self):
        data = CalendarEventCreate(
            title="Meeting",
            start_time=datetime(2026, 3, 20, 10, 0),
            end_time=datetime(2026, 3, 20, 11, 0),
        )
        assert data.title == "Meeting"
        assert data.all_day is False

    def test_event_note_create(self):
        note = EventNoteCreate(content="My note")
        assert note.content == "My note"

    def test_calendar_event_update_partial(self):
        update = CalendarEventUpdate(title="New title")
        dumped = update.model_dump(exclude_unset=True)
        assert dumped == {"title": "New title"}
        assert "start_time" not in dumped
