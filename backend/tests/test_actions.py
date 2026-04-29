from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException
from httpx import ASGITransport, AsyncClient

from app.core.database import get_db
from app.core.deps import get_current_user
from app.main import app
from app.models.reminder import Reminder, ReminderStatus
from app.models.user import User, UserRole
from app.schemas.action import ActionCreate, ActionResponse, ActionUpdate
from app.services import actions as action_service


def _make_user(user_id: int = 1) -> User:
    user = User()
    user.id = user_id
    user.role = UserRole.member
    user.email = f"user{user_id}@example.com"
    user.display_name = f"User {user_id}"
    user.is_blocked = False
    user.must_change_password = False
    user.timezone = "UTC"
    return user


def _override_auth(user: User):
    async def _dep():
        return user

    return _dep


def _override_db():
    async def _dep():
        yield AsyncMock()

    return _dep


def _make_action(
    *,
    id_: int = 1,
    title: str = "Action",
    action_date: date | None = None,
    remind_at: datetime | None = None,
    is_urgent: bool = False,
) -> Reminder:
    now = datetime(2026, 5, 1, 12, 0, tzinfo=timezone.utc)
    action = Reminder()
    action.id = id_
    action.user_id = 1
    action.title = title
    action.details = None
    action.checklist = []
    action.action_date = action_date
    action.remind_at = remind_at
    action.status = ReminderStatus.pending
    action.snoozed_until = None
    action.recurrence_rule = None
    action.snooze_count = 0
    action.notification_sent_count = 0
    action.completed_at = None
    action.is_floating = remind_at is None
    action.is_urgent = is_urgent
    action.created_at = now
    action.updated_at = now
    return action


def test_action_schemas_support_inbox_anytime_and_scheduled_modes():
    scheduled_at = datetime(2026, 5, 2, 15, 30, tzinfo=timezone.utc)

    inbox = ActionCreate(title="Read notes")
    anytime = ActionCreate(title="Pay tax", action_date=date(2026, 5, 2))
    scheduled = ActionCreate(
        title="Call dentist",
        action_date=date(2026, 5, 2),
        remind_at=scheduled_at,
    )
    update = ActionUpdate(action_date=None, remind_at=None)

    assert inbox.action_date is None
    assert inbox.remind_at is None
    assert anytime.action_date == date(2026, 5, 2)
    assert anytime.remind_at is None
    assert scheduled.remind_at == scheduled_at
    assert update.action_date is None
    assert update.remind_at is None
    assert not hasattr(inbox, "task_id")

    inbox_response = ActionResponse.model_validate(_make_action())
    assert inbox_response.mode == "inbox"
    assert not hasattr(inbox_response, "task_id")
    assert (
        ActionResponse.model_validate(
            _make_action(action_date=date(2026, 5, 2))
        ).mode
        == "anytime"
    )
    assert (
        ActionResponse.model_validate(
            _make_action(action_date=date(2026, 5, 2), remind_at=scheduled_at)
        ).mode
        == "scheduled"
    )


@pytest.mark.asyncio
async def test_create_action_persists_title_only_as_inbox(monkeypatch):
    db = AsyncMock()
    db.add = MagicMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    schedule = MagicMock()
    monkeypatch.setattr(action_service, "_schedule_if_eligible", schedule)

    action = await action_service.create_action(
        db,
        title="Capture idea",
        user=_make_user(),
    )

    assert action.action_date is None
    assert action.remind_at is None
    assert action.mode == "inbox"
    assert action.is_floating is True
    db.add.assert_called_once()
    db.commit.assert_awaited_once()
    schedule.assert_not_called()


@pytest.mark.asyncio
async def test_create_action_persists_date_only_as_anytime(monkeypatch):
    db = AsyncMock()
    db.add = MagicMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    schedule = MagicMock()
    monkeypatch.setattr(action_service, "_schedule_if_eligible", schedule)

    action = await action_service.create_action(
        db,
        title="Renew license",
        user=_make_user(),
        action_date=date(2026, 5, 2),
    )

    assert action.action_date == date(2026, 5, 2)
    assert action.remind_at is None
    assert action.mode == "anytime"
    assert action.is_floating is True
    schedule.assert_not_called()


@pytest.mark.asyncio
async def test_create_action_persists_date_and_time_as_scheduled(monkeypatch):
    remind_at = datetime(2026, 5, 2, 15, 30, tzinfo=timezone.utc)
    db = AsyncMock()
    db.add = MagicMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    schedule = MagicMock()
    monkeypatch.setattr(action_service, "_schedule_if_eligible", schedule)

    action = await action_service.create_action(
        db,
        title="Call dentist",
        user=_make_user(),
        action_date=date(2026, 5, 2),
        remind_at=remind_at,
    )

    assert action.action_date == date(2026, 5, 2)
    assert action.remind_at == remind_at
    assert action.mode == "scheduled"
    assert action.is_floating is False
    schedule.assert_called_once_with(action)


@pytest.mark.asyncio
async def test_action_list_orders_overdue_today_future_and_inbox(monkeypatch):
    now = datetime(2026, 5, 2, 12, 0, tzinfo=timezone.utc)
    actions = [
        _make_action(id_=1, title="Inbox normal"),
        _make_action(id_=2, title="Today anytime", action_date=date(2026, 5, 2)),
        _make_action(id_=3, title="Today scheduled", action_date=date(2026, 5, 2), remind_at=now + timedelta(hours=2)),
        _make_action(id_=4, title="Overdue anytime", action_date=date(2026, 5, 1)),
        _make_action(id_=5, title="Inbox urgent", is_urgent=True),
        _make_action(id_=6, title="Today urgent anytime", action_date=date(2026, 5, 2), is_urgent=True),
    ]
    monkeypatch.setattr(action_service, "_today_for_user", lambda user: date(2026, 5, 2))

    ordered = action_service.sort_actions_for_list(actions, _make_user())

    assert [a.title for a in ordered] == [
        "Overdue anytime",
        "Today scheduled",
        "Today urgent anytime",
        "Today anytime",
        "Inbox urgent",
        "Inbox normal",
    ]


@pytest.mark.asyncio
async def test_post_actions_title_only_returns_inbox(monkeypatch):
    user = _make_user()
    action = _make_action(id_=55, title="Read notes")
    captured: dict[str, object] = {}

    async def fake_create_action(db, **kwargs):
        captured.update(kwargs)
        return action

    monkeypatch.setattr(action_service, "create_action", fake_create_action)
    app.dependency_overrides[get_current_user] = _override_auth(user)
    app.dependency_overrides[get_db] = _override_db()
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.post("/api/actions/", json={"title": "Read notes"})
        assert resp.status_code == 201
        data = resp.json()
        assert data["mode"] == "inbox"
        assert data["action_date"] is None
        assert data["remind_at"] is None
        assert captured["title"] == "Read notes"
        assert captured["action_date"] is None
        assert captured["remind_at"] is None
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_db, None)


@pytest.mark.asyncio
async def test_snooze_rejects_anytime_action(monkeypatch):
    action = _make_action(action_date=date(2026, 5, 2), remind_at=None)
    monkeypatch.setattr(
        action_service,
        "get_action",
        AsyncMock(return_value=action),
    )

    with pytest.raises(HTTPException) as exc:
        await action_service.snooze_action(AsyncMock(), 1, _make_user(), minutes=15)

    assert exc.value.status_code == 400
    assert "scheduled" in exc.value.detail.lower()


def test_schedule_if_eligible_ignores_inbox_and_anytime(monkeypatch):
    scheduled = MagicMock()
    monkeypatch.setattr(action_service, "schedule_reminder_notification", scheduled)

    action_service._schedule_if_eligible(_make_action(title="Inbox"))
    action_service._schedule_if_eligible(
        _make_action(title="Anytime", action_date=date(2026, 5, 2))
    )

    scheduled.assert_not_called()


@pytest.mark.asyncio
async def test_mark_done_advances_recurring_anytime_without_remind_at(monkeypatch):
    action = _make_action(
        id_=77,
        title="Water plants",
        action_date=date(2026, 5, 2),
        remind_at=None,
    )
    action.recurrence_rule = "weekly"
    action.checklist = [{"id": "water", "text": "Water", "completed": True}]

    db = AsyncMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    monkeypatch.setattr(action_service, "get_action", AsyncMock(return_value=action))
    scheduled_job = MagicMock()
    cancel = MagicMock()
    monkeypatch.setattr(action_service, "schedule_reminder_notification", scheduled_job)
    monkeypatch.setattr(action_service, "cancel_reminder_notification", cancel)

    result = await action_service.mark_done(db, action.id, _make_user())

    assert result is action
    assert action.action_date == date(2026, 5, 9)
    assert action.remind_at is None
    assert action.status == ReminderStatus.pending
    assert action.checklist == [{"id": "water", "text": "Water", "completed": False}]
    scheduled_job.assert_not_called()
    cancel.assert_not_called()
