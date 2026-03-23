"""
Unit tests for task reminders service — mocked DB.
"""
from __future__ import annotations

import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock

from app.models.task import Task, TaskStatus, TaskPriority
from app.models.user import User, UserRole
from app.services import task_reminders as svc


def make_user(user_id: int = 1) -> User:
    u = User()
    u.id = user_id
    u.role = UserRole.member
    u.email = f"user{user_id}@example.com"
    u.display_name = f"User {user_id}"
    return u


def make_task(
    task_id: int = 1,
    user_id: int = 1,
    reminder_at: datetime | None = None,
    reminder_dismissed: bool = False,
    status: TaskStatus = TaskStatus.in_progress,
) -> Task:
    t = Task()
    t.id = task_id
    t.user_id = user_id
    t.title = f"Task {task_id}"
    t.reminder_at = reminder_at
    t.reminder_dismissed = reminder_dismissed
    t.status = status
    t.priority = TaskPriority.medium
    return t


@pytest.mark.asyncio
async def test_get_due_reminders_returns_tasks():
    """Returns tasks with due reminders."""
    now = datetime.now(tz=timezone.utc)
    task = make_task(reminder_at=now - timedelta(minutes=5))

    db = AsyncMock()
    result = MagicMock()
    result.scalars.return_value.all.return_value = [task]
    db.execute = AsyncMock(return_value=result)

    user = make_user()
    tasks = await svc.get_due_reminders(db, user)
    assert len(tasks) == 1
    assert tasks[0].id == 1


@pytest.mark.asyncio
async def test_get_due_reminders_empty_when_none():
    """Returns empty list when no reminders are due."""
    db = AsyncMock()
    result = MagicMock()
    result.scalars.return_value.all.return_value = []
    db.execute = AsyncMock(return_value=result)

    user = make_user()
    tasks = await svc.get_due_reminders(db, user)
    assert tasks == []


@pytest.mark.asyncio
async def test_dismiss_reminder_marks_dismissed():
    """Sets reminder_dismissed=True and commits."""
    task = make_task(reminder_at=datetime.now(tz=timezone.utc), reminder_dismissed=False)

    db = AsyncMock()
    result = MagicMock()
    result.scalar_one_or_none.return_value = task
    db.execute = AsyncMock(return_value=result)
    db.commit = AsyncMock()
    db.refresh = AsyncMock()

    user = make_user()
    returned = await svc.dismiss_reminder(db, task_id=1, user=user)

    assert returned is not None
    assert task.reminder_dismissed is True
    db.commit.assert_called_once()


@pytest.mark.asyncio
async def test_dismiss_reminder_returns_none_when_not_found():
    """Returns None when task doesn't exist or belongs to another user."""
    db = AsyncMock()
    result = MagicMock()
    result.scalar_one_or_none.return_value = None
    db.execute = AsyncMock(return_value=result)

    user = make_user()
    returned = await svc.dismiss_reminder(db, task_id=999, user=user)
    assert returned is None
