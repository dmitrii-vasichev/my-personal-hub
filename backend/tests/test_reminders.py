from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.models.reminder import Reminder, ReminderStatus
from app.models.user import User, UserRole
from app.schemas.reminder import ReminderCreate, ReminderUpdate
from app.services import reminders as reminder_service


def _make_user(user_id: int = 1) -> User:
    user = User()
    user.id = user_id
    user.role = UserRole.member
    user.email = f"user{user_id}@example.com"
    user.display_name = f"User {user_id}"
    return user


def _checklist(completed: bool = False) -> list[dict[str, object]]:
    return [
        {"id": "open-link", "text": "Open the reference link", "completed": completed},
        {"id": "send-note", "text": "Send a short update", "completed": completed},
    ]


def test_reminder_schemas_accept_details_and_checklist():
    remind_at = datetime(2026, 5, 1, 15, 30, tzinfo=timezone.utc)
    checklist = _checklist()

    create = ReminderCreate(
        title="Prepare renewal",
        remind_at=remind_at,
        details="Use https://example.com/renewal and follow the saved instructions.",
        checklist=checklist,
    )
    update = ReminderUpdate(details="Updated notes", checklist=checklist)

    assert create.details == "Use https://example.com/renewal and follow the saved instructions."
    assert create.checklist == checklist
    assert update.details == "Updated notes"
    assert update.checklist == checklist


@pytest.mark.asyncio
async def test_create_reminder_persists_details_and_checklist():
    remind_at = datetime(2026, 5, 1, 15, 30, tzinfo=timezone.utc)
    checklist = _checklist()
    db = AsyncMock()
    db.add = MagicMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()

    reminder = await reminder_service.create_reminder(
        db,
        title="Prepare renewal",
        remind_at=remind_at,
        user=_make_user(),
        details="Read https://example.com/renewal first.",
        checklist=checklist,
    )

    assert reminder.details == "Read https://example.com/renewal first."
    assert reminder.checklist == checklist
    db.add.assert_called_once()
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_mark_done_resets_recurring_checklist_and_preserves_details(monkeypatch):
    original_time = datetime(2026, 5, 1, 15, 30, tzinfo=timezone.utc)
    reminder = Reminder()
    reminder.id = 42
    reminder.user_id = 1
    reminder.title = "Weekly review"
    reminder.remind_at = original_time
    reminder.status = ReminderStatus.pending
    reminder.recurrence_rule = "weekly"
    reminder.snooze_count = 3
    reminder.notification_sent_count = 1
    reminder.snoozed_until = original_time + timedelta(minutes=30)
    reminder.telegram_message_id = 123
    reminder.is_floating = False
    reminder.details = "Keep this instruction and link: https://example.com/review"
    reminder.checklist = _checklist(completed=True)

    db = AsyncMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    monkeypatch.setattr(
        reminder_service,
        "get_reminder",
        AsyncMock(return_value=reminder),
    )
    schedule = MagicMock()
    monkeypatch.setattr(reminder_service, "_schedule_if_eligible", schedule)

    result = await reminder_service.mark_done(db, reminder.id, _make_user())

    assert result is reminder
    assert reminder.remind_at == original_time + timedelta(weeks=1)
    assert reminder.details == "Keep this instruction and link: https://example.com/review"
    assert reminder.checklist == [
        {"id": "open-link", "text": "Open the reference link", "completed": False},
        {"id": "send-note", "text": "Send a short update", "completed": False},
    ]
    assert reminder.snooze_count == 0
    assert reminder.notification_sent_count == 0
    assert reminder.snoozed_until is None
    assert reminder.telegram_message_id is None
    db.commit.assert_awaited_once()
    schedule.assert_called_once_with(reminder)
