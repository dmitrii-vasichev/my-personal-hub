"""
Regression tests: reminder_at must be persisted when creating/updating tasks.

Verifies fix for #363 — reminder_at was accepted by API schema but not saved
to the database by create_task() and update_task().
"""
from __future__ import annotations

import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

from app.models.task import Task, TaskStatus, TaskPriority, Visibility
from app.models.user import User, UserRole
from app.schemas.task import TaskCreate, TaskUpdate as TaskUpdateSchema
from app.services.task import create_task, update_task


def make_user(user_id: int = 1, role: UserRole = UserRole.admin) -> User:
    u = User()
    u.id = user_id
    u.role = role
    u.email = f"user{user_id}@example.com"
    u.display_name = f"User {user_id}"
    return u


def _capture_task_add(db_mock: AsyncMock) -> list[Task]:
    """Capture Task objects passed to db.add()."""
    captured: list[Task] = []
    original_add = db_mock.add

    def side_effect(obj):
        if isinstance(obj, Task):
            captured.append(obj)

    db_mock.add = MagicMock(side_effect=side_effect)
    return captured


def _make_create_db_mock() -> AsyncMock:
    """Create a db mock that handles both kanban_order query and normal ops."""
    db = AsyncMock()
    db.flush = AsyncMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    # _get_min_kanban_order calls db.execute(...) then result.scalar()
    kanban_result = MagicMock()
    kanban_result.scalar.return_value = None
    db.execute = AsyncMock(return_value=kanban_result)
    return db


@pytest.mark.asyncio
async def test_create_task_saves_reminder_at():
    """reminder_at is set on the Task object during creation."""
    reminder = datetime(2026, 3, 15, 9, 0, tzinfo=timezone.utc)
    data = TaskCreate(title="Test task", reminder_at=reminder)
    user = make_user()

    db = _make_create_db_mock()

    task = await create_task(db, data, user)

    assert task.reminder_at == reminder


@pytest.mark.asyncio
async def test_create_task_without_reminder():
    """Creating a task without reminder_at works fine (None)."""
    data = TaskCreate(title="No reminder task")
    user = make_user()

    db = _make_create_db_mock()

    task = await create_task(db, data, user)

    assert task.reminder_at is None


@pytest.mark.asyncio
async def test_update_task_saves_reminder_at():
    """reminder_at is updated when patching a task."""
    existing_task = Task()
    existing_task.id = 1
    existing_task.user_id = 1
    existing_task.title = "Existing"
    existing_task.status = TaskStatus.new
    existing_task.reminder_at = None
    existing_task.reminder_dismissed = False
    existing_task.updated_at = datetime.now(timezone.utc)

    user = make_user()
    reminder = datetime(2026, 3, 20, 14, 0, tzinfo=timezone.utc)
    data = TaskUpdateSchema(reminder_at=reminder)

    db = AsyncMock()
    result_mock = MagicMock()
    result_mock.unique.return_value.scalar_one_or_none.return_value = existing_task
    db.execute = AsyncMock(return_value=result_mock)
    db.commit = AsyncMock()
    db.refresh = AsyncMock()

    updated = await update_task(db, task_id=1, data=data, current_user=user)

    assert updated is not None
    assert updated.reminder_at == reminder
    assert updated.reminder_dismissed is False


@pytest.mark.asyncio
async def test_update_task_resets_dismissed_on_new_reminder():
    """When reminder_at changes, reminder_dismissed resets to False."""
    old_reminder = datetime(2026, 3, 10, 9, 0, tzinfo=timezone.utc)
    existing_task = Task()
    existing_task.id = 1
    existing_task.user_id = 1
    existing_task.title = "Existing"
    existing_task.status = TaskStatus.new
    existing_task.reminder_at = old_reminder
    existing_task.reminder_dismissed = True
    existing_task.updated_at = datetime.now(timezone.utc)

    user = make_user()
    new_reminder = datetime(2026, 3, 25, 10, 0, tzinfo=timezone.utc)
    data = TaskUpdateSchema(reminder_at=new_reminder)

    db = AsyncMock()
    result_mock = MagicMock()
    result_mock.unique.return_value.scalar_one_or_none.return_value = existing_task
    db.execute = AsyncMock(return_value=result_mock)
    db.commit = AsyncMock()
    db.refresh = AsyncMock()

    updated = await update_task(db, task_id=1, data=data, current_user=user)

    assert updated is not None
    assert updated.reminder_at == new_reminder
    assert updated.reminder_dismissed is False
