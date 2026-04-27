"""Tests for task primary draft document linking."""
from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from app.models.task import Task, TaskPriority, TaskSource, TaskStatus, Visibility
from app.models.user import User, UserRole
from app.schemas.task import TaskUpdate
from app.services import task as task_service


def _make_user(uid: int = 1) -> User:
    user = User()
    user.id = uid
    user.role = UserRole.member
    user.email = f"user{uid}@example.com"
    user.display_name = f"User {uid}"
    return user


def _make_task(task_id: int = 10, user_id: int = 1) -> Task:
    task = Task()
    task.id = task_id
    task.user_id = user_id
    task.created_by_id = user_id
    task.assignee_id = None
    task.linked_document_id = None
    task.title = "Draft task"
    task.description = None
    task.status = TaskStatus.new
    task.priority = TaskPriority.medium
    task.checklist = []
    task.source = TaskSource.web
    task.visibility = Visibility.family
    task.owner = None
    return task


@pytest.mark.asyncio
async def test_update_task_sets_primary_document_and_ensures_note_link(
    monkeypatch,
):
    db = AsyncMock()
    task = _make_task()
    note = object()
    ensure = AsyncMock()
    monkeypatch.setattr(
        task_service, "_load_task_with_users", AsyncMock(return_value=task)
    )
    monkeypatch.setattr(task_service, "_get_owned_note", AsyncMock(return_value=note))
    monkeypatch.setattr(task_service, "_ensure_note_task_link", ensure)

    result = await task_service.update_task(
        db,
        task_id=task.id,
        data=TaskUpdate(linked_document_id=5),
        current_user=_make_user(),
    )

    assert result is task
    assert task.linked_document_id == 5
    ensure.assert_awaited_once_with(db, 5, task.id)
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_update_task_clears_primary_document(monkeypatch):
    db = AsyncMock()
    task = _make_task()
    task.linked_document_id = 5
    ensure = AsyncMock()
    monkeypatch.setattr(
        task_service, "_load_task_with_users", AsyncMock(return_value=task)
    )
    monkeypatch.setattr(task_service, "_ensure_note_task_link", ensure)

    result = await task_service.update_task(
        db,
        task_id=task.id,
        data=TaskUpdate(linked_document_id=None),
        current_user=_make_user(),
    )

    assert result is task
    assert task.linked_document_id is None
    ensure.assert_not_awaited()
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_update_task_rejects_cross_user_primary_document(monkeypatch):
    db = AsyncMock()
    task = _make_task()
    monkeypatch.setattr(
        task_service, "_load_task_with_users", AsyncMock(return_value=task)
    )
    monkeypatch.setattr(task_service, "_get_owned_note", AsyncMock(return_value=None))

    with pytest.raises(task_service.LinkedDocumentNotFoundError):
        await task_service.update_task(
            db,
            task_id=task.id,
            data=TaskUpdate(linked_document_id=99),
            current_user=_make_user(),
        )

    db.commit.assert_not_awaited()
