"""
Phase 9 — Visibility and access control tests.
Tests for calendar visibility filtering and owner-based edit/delete restrictions.
"""
import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

from app.models.calendar import CalendarEvent, EventSource
from app.models.job import Job
from app.models.visibility import Visibility
from app.models.user import User, UserRole
from app.services import calendar as calendar_service
from app.services import job as job_service
from app.services.calendar import PermissionDeniedError


# ── Helpers ──────────────────────────────────────────────────────────────────


def make_user(role: UserRole = UserRole.member, user_id: int = 1) -> User:
    u = User()
    u.id = user_id
    u.role = role
    u.email = f"user{user_id}@example.com"
    u.display_name = f"User {user_id}"
    return u


def make_event(
    user_id: int = 1,
    event_id: int = 10,
    visibility: Visibility = Visibility.family,
) -> CalendarEvent:
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
    e.visibility = visibility
    e.notes = []
    return e


def make_job(user_id: int = 1, job_id: int = 10) -> Job:
    j = Job()
    j.id = job_id
    j.user_id = user_id
    j.title = "Software Engineer"
    j.company = "TestCorp"
    return j


def _mock_unique_result(value):
    """Create mock result supporting .unique().scalar_one_or_none() chain."""
    unique_mock = MagicMock()
    unique_mock.scalar_one_or_none.return_value = value
    mock_result = MagicMock()
    mock_result.unique.return_value = unique_mock
    mock_result.scalar_one_or_none.return_value = value
    return mock_result


# ── Calendar visibility tests ────────────────────────────────────────────────


class TestCalendarVisibility:
    """Tests for calendar event visibility rules."""

    def test_member_can_read_own_event(self):
        user = make_user(user_id=1)
        event = make_event(user_id=1, visibility=Visibility.private)
        assert calendar_service._can_access_event(event, user) is True

    def test_member_can_read_others_family_event(self):
        user = make_user(user_id=2)
        event = make_event(user_id=1, visibility=Visibility.family)
        assert calendar_service._can_access_event(event, user) is True

    def test_member_cannot_read_others_private_event(self):
        user = make_user(user_id=2)
        event = make_event(user_id=1, visibility=Visibility.private)
        assert calendar_service._can_access_event(event, user) is False

    def test_admin_can_read_any_event(self):
        admin = make_user(role=UserRole.admin, user_id=99)
        event = make_event(user_id=1, visibility=Visibility.private)
        assert calendar_service._can_access_event(event, admin) is True


class TestCalendarAccessControl:
    """Tests for calendar event edit/delete permission rules."""

    def test_member_can_edit_own_event(self):
        user = make_user(user_id=1)
        event = make_event(user_id=1)
        assert calendar_service._can_edit_event(event, user) is True

    def test_member_cannot_edit_others_family_event(self):
        user = make_user(user_id=2)
        event = make_event(user_id=1, visibility=Visibility.family)
        assert calendar_service._can_edit_event(event, user) is False

    def test_admin_can_edit_any_event(self):
        admin = make_user(role=UserRole.admin, user_id=99)
        event = make_event(user_id=1)
        assert calendar_service._can_edit_event(event, admin) is True


@pytest.mark.asyncio
class TestCalendarEditDeleteRestrictions:
    """Tests for 403 on update/delete of non-owned events."""

    async def test_update_others_family_event_raises_403(self):
        db = AsyncMock()
        event = make_event(user_id=1, visibility=Visibility.family)
        db.execute = AsyncMock(return_value=_mock_unique_result(event))

        user = make_user(user_id=2)
        from app.schemas.calendar import CalendarEventUpdate

        with pytest.raises(PermissionDeniedError):
            await calendar_service.update_event(
                db, 10, CalendarEventUpdate(title="Hacked"), user
            )

    async def test_delete_others_family_event_raises_403(self):
        db = AsyncMock()
        event = make_event(user_id=1, visibility=Visibility.family)
        # delete_event doesn't use .unique() - it uses plain scalar_one_or_none
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = event
        db.execute = AsyncMock(return_value=mock_result)

        user = make_user(user_id=2)
        with pytest.raises(PermissionDeniedError):
            await calendar_service.delete_event(db, 10, user)

    async def test_admin_can_delete_any_event(self):
        db = AsyncMock()
        event = make_event(user_id=1)
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = event
        db.execute = AsyncMock(return_value=mock_result)
        db.delete = AsyncMock()
        db.commit = AsyncMock()

        admin = make_user(role=UserRole.admin, user_id=99)
        result = await calendar_service.delete_event(db, 10, admin)
        assert result is True


# ── Jobs access control tests ────────────────────────────────────────────────


class TestJobsAccessControl:
    """Jobs are always private per user — no visibility field."""

    def test_member_can_access_own_job(self):
        user = make_user(user_id=1)
        job = make_job(user_id=1)
        assert job_service._can_access(job, user) is True

    def test_member_cannot_access_others_job(self):
        user = make_user(user_id=2)
        job = make_job(user_id=1)
        assert job_service._can_access(job, user) is False

    def test_admin_can_access_any_job(self):
        admin = make_user(role=UserRole.admin, user_id=99)
        job = make_job(user_id=1)
        assert job_service._can_access(job, admin) is True


@pytest.mark.asyncio
class TestJobsCRUDAccessControl:
    async def test_member_cannot_get_others_job(self):
        db = AsyncMock()
        job = make_job(user_id=1, job_id=10)
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = job
        db.execute = AsyncMock(return_value=mock_result)

        user = make_user(user_id=2)
        result = await job_service.get_job(db, 10, user)
        assert result is None

    async def test_member_cannot_delete_others_job(self):
        db = AsyncMock()
        job = make_job(user_id=1, job_id=10)
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = job
        db.execute = AsyncMock(return_value=mock_result)

        user = make_user(user_id=2)
        result = await job_service.delete_job(db, 10, user)
        assert result is False


