from __future__ import annotations

from datetime import date, datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.database import get_db
from app.core.deps import get_current_user
from app.main import app
from app.models.reminder import Reminder, ReminderStatus
from app.models.task import Task
from app.models.user import User, UserRole
from app.services import task_cleanup


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


def _make_task(task_id: int = 10, title: str = "Legacy task") -> Task:
    task = Task()
    task.id = task_id
    task.user_id = 1
    task.title = title
    return task


def _make_reminder(reminder_id: int = 20, task_id: int | None = 10) -> Reminder:
    now = datetime(2026, 5, 1, 12, 0, tzinfo=timezone.utc)
    reminder = Reminder()
    reminder.id = reminder_id
    reminder.user_id = 1
    reminder.title = "Renew passport"
    reminder.details = "Bring documents and payment link"
    reminder.checklist = [
        {"id": "docs", "text": "Documents", "completed": False},
        {"id": "pay", "text": "Payment", "completed": True},
    ]
    reminder.action_date = date(2026, 5, 2)
    reminder.remind_at = datetime(2026, 5, 2, 15, 30, tzinfo=timezone.utc)
    reminder.status = ReminderStatus.pending
    reminder.snoozed_until = None
    reminder.recurrence_rule = "weekly"
    reminder.snooze_count = 0
    reminder.notification_sent_count = 0
    reminder.task_id = task_id
    reminder.completed_at = None
    reminder.is_floating = False
    reminder.is_urgent = True
    reminder.created_at = now
    reminder.updated_at = now
    return reminder


@pytest.mark.asyncio
async def test_review_task_linked_reminders_includes_required_fields():
    reminder = _make_reminder()
    task = _make_task(title="Passport admin")
    result = MagicMock()
    result.all.return_value = [(reminder, task)]
    db = AsyncMock()
    db.execute = AsyncMock(return_value=result)

    review = await task_cleanup.list_task_linked_reminder_review(db, _make_user())

    assert len(review) == 1
    item = review[0]
    assert item.task_id == 10
    assert item.task_title == "Passport admin"
    assert item.reminder_id == 20
    assert item.reminder_title == "Renew passport"
    assert item.action_date == date(2026, 5, 2)
    assert item.remind_at == datetime(2026, 5, 2, 15, 30, tzinfo=timezone.utc)
    assert item.is_urgent is True
    assert item.recurrence_rule == "weekly"
    assert item.details == "Bring documents and payment link"
    assert item.checklist_count == 2


@pytest.mark.asyncio
async def test_preserve_selected_task_linked_reminders_detaches_task_id_and_commits():
    reminder = _make_reminder(reminder_id=42)
    result = MagicMock()
    result.scalars.return_value.all.return_value = [reminder]
    db = AsyncMock()
    db.execute = AsyncMock(return_value=result)
    db.commit = AsyncMock()

    response = await task_cleanup.preserve_task_linked_reminders(
        db, _make_user(), reminder_ids=[42, 99]
    )

    assert response.preserved_count == 1
    assert response.reminder_ids == [42]
    assert reminder.task_id is None
    db.commit.assert_awaited_once()
    db.delete.assert_not_called()


@pytest.mark.asyncio
async def test_preserve_selected_task_linked_reminders_noops_empty_selection():
    db = AsyncMock()

    response = await task_cleanup.preserve_task_linked_reminders(
        db, _make_user(), reminder_ids=[]
    )

    assert response.preserved_count == 0
    assert response.reminder_ids == []
    db.execute.assert_not_called()
    db.commit.assert_not_called()


@pytest.mark.asyncio
async def test_task_cleanup_review_api_returns_dry_run(monkeypatch):
    user = _make_user()
    item = task_cleanup.TaskLinkedReminderReviewItem(
        task_id=10,
        task_title="Passport admin",
        reminder_id=20,
        reminder_title="Renew passport",
        action_date=date(2026, 5, 2),
        remind_at=None,
        is_urgent=True,
        recurrence_rule=None,
        details="Bring documents",
        checklist_count=1,
    )

    async def fake_review(db, current_user):
        assert current_user is user
        return [item]

    async def fake_db():
        yield AsyncMock()

    async def fake_user():
        return user

    monkeypatch.setattr(task_cleanup, "list_task_linked_reminder_review", fake_review)
    app.dependency_overrides[get_db] = fake_db
    app.dependency_overrides[get_current_user] = fake_user
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/actions/task-cleanup/review")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()[0]["task_title"] == "Passport admin"
    assert response.json()[0]["checklist_count"] == 1
