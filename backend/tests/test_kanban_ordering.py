"""
Tests for Kanban ordering: new/moved tasks at top, manual reorder.
Closes #398.
"""
from __future__ import annotations

import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

from app.models.task import Task, TaskStatus, TaskPriority, Visibility
from app.models.user import User, UserRole
from app.schemas.task import TaskCreate, TaskUpdate as TaskUpdateSchema
from app.services.task import create_task, update_task, reorder_task


def make_user(user_id: int = 1, role: UserRole = UserRole.admin) -> User:
    u = User()
    u.id = user_id
    u.role = role
    u.email = f"user{user_id}@example.com"
    u.display_name = f"User {user_id}"
    return u


def make_task(task_id: int, kanban_order: float = 0, status: TaskStatus = TaskStatus.new) -> Task:
    t = Task()
    t.id = task_id
    t.user_id = 1
    t.created_by_id = 1
    t.title = f"Task {task_id}"
    t.status = status
    t.priority = TaskPriority.medium
    t.kanban_order = kanban_order
    t.visibility = Visibility.family
    t.reminder_at = None
    t.reminder_dismissed = False
    t.updated_at = datetime.now(timezone.utc)
    return t


def _make_db_mock(min_order: float | None = None) -> AsyncMock:
    """Create db mock that handles _get_min_kanban_order query."""
    db = AsyncMock()
    db.flush = AsyncMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    result_mock = MagicMock()
    result_mock.scalar.return_value = min_order
    db.execute = AsyncMock(return_value=result_mock)
    return db


# ── create_task places at top ─────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_task_kanban_order_when_column_empty():
    """New task in empty column gets kanban_order = 0."""
    db = _make_db_mock(min_order=None)
    data = TaskCreate(title="First task")
    user = make_user()

    task = await create_task(db, data, user)
    assert task.kanban_order == 0


@pytest.mark.asyncio
async def test_create_task_kanban_order_before_existing():
    """New task gets kanban_order = min_existing - 1."""
    db = _make_db_mock(min_order=5.0)
    data = TaskCreate(title="New task")
    user = make_user()

    task = await create_task(db, data, user)
    assert task.kanban_order == 4.0


@pytest.mark.asyncio
async def test_create_task_kanban_order_negative():
    """Works correctly with negative min_order."""
    db = _make_db_mock(min_order=-3.0)
    data = TaskCreate(title="Newer task")
    user = make_user()

    task = await create_task(db, data, user)
    assert task.kanban_order == -4.0


# ── update_task resets kanban_order on status change ──────────────────────


@pytest.mark.asyncio
async def test_status_change_places_at_top():
    """Moving task to a different column places it at top."""
    existing_task = make_task(1, kanban_order=5.0, status=TaskStatus.new)

    db = AsyncMock()
    # First execute: _load_task_with_users
    task_result = MagicMock()
    task_result.unique.return_value.scalar_one_or_none.return_value = existing_task
    # Second execute: _get_min_kanban_order
    order_result = MagicMock()
    order_result.scalar.return_value = 2.0
    db.execute = AsyncMock(side_effect=[task_result, order_result])
    db.commit = AsyncMock()
    db.refresh = AsyncMock()

    user = make_user()
    data = TaskUpdateSchema(status=TaskStatus.in_progress)
    task = await update_task(db, task_id=1, data=data, current_user=user)

    assert task is not None
    assert task.kanban_order == 1.0  # min(2.0) - 1


# ── reorder_task ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_reorder_between_two_tasks():
    """Reorder places task between two neighbours (average)."""
    task = make_task(1, kanban_order=10.0)
    after_task = make_task(2, kanban_order=3.0)
    before_task = make_task(3, kanban_order=7.0)

    db = AsyncMock()
    task_result = MagicMock()
    task_result.unique.return_value.scalar_one_or_none.return_value = task
    db.execute = AsyncMock(return_value=task_result)
    db.get = AsyncMock(side_effect=lambda model, id: {2: after_task, 3: before_task}.get(id))
    db.commit = AsyncMock()
    db.refresh = AsyncMock()

    user = make_user()
    result = await reorder_task(db, task_id=1, after_task_id=2, before_task_id=3, current_user=user)

    assert result is not None
    assert result.kanban_order == 5.0  # (3.0 + 7.0) / 2


@pytest.mark.asyncio
async def test_reorder_to_first_position():
    """Reorder to first position (after_task_id=None)."""
    task = make_task(1, kanban_order=10.0)
    before_task = make_task(2, kanban_order=3.0)

    db = AsyncMock()
    task_result = MagicMock()
    task_result.unique.return_value.scalar_one_or_none.return_value = task
    db.execute = AsyncMock(return_value=task_result)
    db.get = AsyncMock(side_effect=lambda model, id: {2: before_task}.get(id))
    db.commit = AsyncMock()
    db.refresh = AsyncMock()

    user = make_user()
    result = await reorder_task(db, task_id=1, after_task_id=None, before_task_id=2, current_user=user)

    assert result is not None
    assert result.kanban_order == 2.0  # before(3.0) - 1


@pytest.mark.asyncio
async def test_reorder_to_last_position():
    """Reorder to last position (before_task_id=None)."""
    task = make_task(1, kanban_order=0.0)
    after_task = make_task(2, kanban_order=5.0)

    db = AsyncMock()
    task_result = MagicMock()
    task_result.unique.return_value.scalar_one_or_none.return_value = task
    db.execute = AsyncMock(return_value=task_result)
    db.get = AsyncMock(side_effect=lambda model, id: {2: after_task}.get(id))
    db.commit = AsyncMock()
    db.refresh = AsyncMock()

    user = make_user()
    result = await reorder_task(db, task_id=1, after_task_id=2, before_task_id=None, current_user=user)

    assert result is not None
    assert result.kanban_order == 6.0  # after(5.0) + 1
