"""
Tests for backlog status in Kanban board.
Closes #400, #402, #403, #404.
"""
from __future__ import annotations

import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

from app.models.task import Task, TaskStatus, TaskPriority, Visibility
from app.models.user import User, UserRole
from app.schemas.task import TaskCreate, TaskUpdate as TaskUpdateSchema, KanbanBoard
from app.services.task import create_task, update_task


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
    db = AsyncMock()
    db.flush = AsyncMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    result_mock = MagicMock()
    result_mock.scalar.return_value = min_order
    db.execute = AsyncMock(return_value=result_mock)
    return db


# ── TaskStatus enum ──────────────────────────────────────────────────────


def test_backlog_in_task_status():
    """backlog is a valid TaskStatus value."""
    assert TaskStatus.backlog == "backlog"
    assert TaskStatus.backlog.value == "backlog"


def test_backlog_is_first_status():
    """backlog is the first member of TaskStatus."""
    members = list(TaskStatus)
    assert members[0] == TaskStatus.backlog


# ── KanbanBoard schema ──────────────────────────────────────────────────


def test_kanban_board_has_backlog_field():
    """KanbanBoard schema includes backlog field."""
    board = KanbanBoard()
    assert hasattr(board, "backlog")
    assert board.backlog == []


# ── create_task with backlog status ──────────────────────────────────────


@pytest.mark.asyncio
async def test_create_task_with_backlog_status():
    """Task can be created with backlog status."""
    db = _make_db_mock(min_order=None)
    data = TaskCreate(title="Backlog idea", status=TaskStatus.backlog)
    user = make_user()

    task = await create_task(db, data, user)
    assert task.status == TaskStatus.backlog
    assert task.kanban_order == 0


@pytest.mark.asyncio
async def test_create_task_default_status_is_new():
    """Default status for new tasks is 'new'."""
    db = _make_db_mock(min_order=None)
    data = TaskCreate(title="Regular task")
    user = make_user()

    task = await create_task(db, data, user)
    assert task.status == TaskStatus.new


# ── move task from backlog to new ────────────────────────────────────────


@pytest.mark.asyncio
async def test_move_task_from_backlog_to_new():
    """Task can be moved from backlog to new status."""
    existing_task = make_task(1, kanban_order=5.0, status=TaskStatus.backlog)

    db = AsyncMock()
    task_result = MagicMock()
    task_result.unique.return_value.scalar_one_or_none.return_value = existing_task
    order_result = MagicMock()
    order_result.scalar.return_value = 2.0
    db.execute = AsyncMock(side_effect=[task_result, order_result])
    db.commit = AsyncMock()
    db.refresh = AsyncMock()

    user = make_user()
    data = TaskUpdateSchema(status=TaskStatus.new)
    task = await update_task(db, task_id=1, data=data, current_user=user)

    assert task is not None
    assert task.status == TaskStatus.new
    assert task.kanban_order == 1.0  # min(2.0) - 1
