"""
Tests for tag CRUD, task-tag assignment, tag filter, and bulk operations.
Covers Phase 28 — Task Tags Backend.
"""
from __future__ import annotations

import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

from app.models.tag import Tag, TaskTag
from app.models.task import Task, TaskStatus, TaskPriority, Visibility
from app.models.user import User, UserRole
from app.schemas.tag import TagCreate, TagUpdate, BulkTagRequest, TagBrief, TagResponse
from app.schemas.task import TaskCreate, TaskUpdate as TaskUpdateSchema, TaskResponse as TaskResp


# ── Helpers ──────────────────────────────────────────────────────────────────


def make_user(user_id: int = 1, role: UserRole = UserRole.admin) -> User:
    u = User()
    u.id = user_id
    u.role = role
    u.email = f"user{user_id}@example.com"
    u.display_name = f"User {user_id}"
    return u


def make_tag(tag_id: int = 1, user_id: int = 1, name: str = "bug", color: str = "#ff0000") -> Tag:
    t = Tag()
    t.id = tag_id
    t.user_id = user_id
    t.name = name
    t.color = color
    t.created_at = datetime.now(timezone.utc)
    return t


# ── Schema tests ─────────────────────────────────────────────────────────────


class TestTagSchemas:
    def test_tag_create_defaults(self):
        tag = TagCreate(name="urgent")
        assert tag.name == "urgent"
        assert tag.color == "#4f8ef7"

    def test_tag_create_custom_color(self):
        tag = TagCreate(name="bug", color="#ff0000")
        assert tag.color == "#ff0000"

    def test_tag_update_optional_fields(self):
        tag = TagUpdate()
        assert tag.name is None
        assert tag.color is None

    def test_tag_brief_from_attributes(self):
        t = make_tag(tag_id=5, name="feature", color="#00ff00")
        brief = TagBrief.model_validate(t)
        assert brief.id == 5
        assert brief.name == "feature"
        assert brief.color == "#00ff00"

    def test_tag_response_with_task_count(self):
        resp = TagResponse(
            id=1, name="bug", color="#ff0000",
            task_count=3, created_at=datetime.now(timezone.utc),
        )
        assert resp.task_count == 3

    def test_bulk_tag_request_validation(self):
        req = BulkTagRequest(task_ids=[1, 2, 3], add_tag_ids=[10], remove_tag_ids=[20])
        assert len(req.task_ids) == 3
        assert req.add_tag_ids == [10]
        assert req.remove_tag_ids == [20]

    def test_task_create_has_tag_ids(self):
        data = TaskCreate(title="test task", tag_ids=[1, 2])
        assert data.tag_ids == [1, 2]

    def test_task_create_default_empty_tag_ids(self):
        data = TaskCreate(title="test task")
        assert data.tag_ids == []

    def test_task_update_tag_ids_optional(self):
        data = TaskUpdateSchema(title="updated")
        assert data.tag_ids is None

    def test_task_update_with_tag_ids(self):
        data = TaskUpdateSchema(tag_ids=[3, 4])
        assert data.tag_ids == [3, 4]

    def test_task_response_has_tags_field(self):
        resp = TaskResp(
            id=1, user_id=1, created_by_id=1, assignee_id=None,
            title="t", description=None, status=TaskStatus.new,
            priority=TaskPriority.medium, checklist=[], source="web",
            visibility=Visibility.family, deadline=None, reminder_at=None,
            reminder_dismissed=False, completed_at=None, kanban_order=0,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
            tags=[TagBrief(id=1, name="bug", color="#ff0000")],
        )
        assert len(resp.tags) == 1
        assert resp.tags[0].name == "bug"


# ── Tag service tests ────────────────────────────────────────────────────────


class TestTagService:
    @pytest.mark.asyncio
    async def test_create_tag_success(self):
        from app.services.tag import create_tag

        db = AsyncMock()
        # count check returns 0 (no tags yet)
        count_result = MagicMock()
        count_result.scalar.return_value = 0
        # dup check returns None
        dup_result = MagicMock()
        dup_result.scalar_one_or_none.return_value = None
        db.execute = AsyncMock(side_effect=[count_result, dup_result])
        db.add = MagicMock()
        db.commit = AsyncMock()
        db.refresh = AsyncMock()

        data = TagCreate(name="bug", color="#ff0000")
        tag = await create_tag(db, user_id=1, data=data)

        assert tag.name == "bug"
        assert tag.color == "#ff0000"
        assert tag.user_id == 1
        db.add.assert_called_once()
        db.commit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_create_tag_duplicate_name(self):
        from app.services.tag import create_tag
        from fastapi import HTTPException

        db = AsyncMock()
        count_result = MagicMock()
        count_result.scalar.return_value = 1
        dup_result = MagicMock()
        dup_result.scalar_one_or_none.return_value = make_tag(name="Bug")
        db.execute = AsyncMock(side_effect=[count_result, dup_result])

        data = TagCreate(name="bug")
        with pytest.raises(HTTPException) as exc:
            await create_tag(db, user_id=1, data=data)
        assert exc.value.status_code == 409

    @pytest.mark.asyncio
    async def test_create_tag_limit_exceeded(self):
        from app.services.tag import create_tag, MAX_TAGS_PER_USER
        from fastapi import HTTPException

        db = AsyncMock()
        count_result = MagicMock()
        count_result.scalar.return_value = MAX_TAGS_PER_USER
        db.execute = AsyncMock(return_value=count_result)

        data = TagCreate(name="new-tag")
        with pytest.raises(HTTPException) as exc:
            await create_tag(db, user_id=1, data=data)
        assert exc.value.status_code == 400
        assert "limit" in exc.value.detail.lower()

    @pytest.mark.asyncio
    async def test_get_tag_not_found(self):
        from app.services.tag import get_tag
        from fastapi import HTTPException

        db = AsyncMock()
        result = MagicMock()
        result.scalar_one_or_none.return_value = None
        db.execute = AsyncMock(return_value=result)

        with pytest.raises(HTTPException) as exc:
            await get_tag(db, tag_id=999, user_id=1)
        assert exc.value.status_code == 404

    @pytest.mark.asyncio
    async def test_update_tag_name(self):
        from app.services.tag import update_tag

        existing = make_tag(tag_id=1, name="old-name")

        db = AsyncMock()
        # get_tag returns existing
        get_result = MagicMock()
        get_result.scalar_one_or_none.return_value = existing
        # dup check returns None
        dup_result = MagicMock()
        dup_result.scalar_one_or_none.return_value = None
        db.execute = AsyncMock(side_effect=[get_result, dup_result])
        db.commit = AsyncMock()
        db.refresh = AsyncMock()

        data = TagUpdate(name="new-name")
        tag = await update_tag(db, tag_id=1, user_id=1, data=data)
        assert tag.name == "new-name"

    @pytest.mark.asyncio
    async def test_update_tag_duplicate_name(self):
        from app.services.tag import update_tag
        from fastapi import HTTPException

        existing = make_tag(tag_id=1, name="bug")
        duplicate = make_tag(tag_id=2, name="feature")

        db = AsyncMock()
        get_result = MagicMock()
        get_result.scalar_one_or_none.return_value = existing
        dup_result = MagicMock()
        dup_result.scalar_one_or_none.return_value = duplicate
        db.execute = AsyncMock(side_effect=[get_result, dup_result])

        data = TagUpdate(name="feature")
        with pytest.raises(HTTPException) as exc:
            await update_tag(db, tag_id=1, user_id=1, data=data)
        assert exc.value.status_code == 409

    @pytest.mark.asyncio
    async def test_delete_tag(self):
        from app.services.tag import delete_tag

        existing = make_tag(tag_id=1)

        db = AsyncMock()
        get_result = MagicMock()
        get_result.scalar_one_or_none.return_value = existing
        db.execute = AsyncMock(return_value=get_result)
        db.delete = AsyncMock()
        db.commit = AsyncMock()

        await delete_tag(db, tag_id=1, user_id=1)
        db.delete.assert_awaited_once_with(existing)
        db.commit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_delete_tag_not_found(self):
        from app.services.tag import delete_tag
        from fastapi import HTTPException

        db = AsyncMock()
        result = MagicMock()
        result.scalar_one_or_none.return_value = None
        db.execute = AsyncMock(return_value=result)

        with pytest.raises(HTTPException) as exc:
            await delete_tag(db, tag_id=999, user_id=1)
        assert exc.value.status_code == 404


# ── Task-tag integration tests ───────────────────────────────────────────────


class TestTaskTagIntegration:
    @pytest.mark.asyncio
    async def test_sync_task_tags_validates_ownership(self):
        from app.services.tag import sync_task_tags
        from fastapi import HTTPException

        db = AsyncMock()
        # count returns 1 but we pass 2 tag_ids → mismatch
        count_result = MagicMock()
        count_result.scalar.return_value = 1
        db.execute = AsyncMock(return_value=count_result)

        with pytest.raises(HTTPException) as exc:
            await sync_task_tags(db, task_id=1, tag_ids=[10, 20], user_id=1)
        assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_sync_task_tags_empty_list(self):
        from app.services.tag import sync_task_tags

        db = AsyncMock()
        db.execute = AsyncMock()

        # Should not raise — clears all tags
        await sync_task_tags(db, task_id=1, tag_ids=[], user_id=1)
        # execute called once for delete
        assert db.execute.await_count == 1


# ── Bulk tag tests ───────────────────────────────────────────────────────────


class TestBulkTag:
    @pytest.mark.asyncio
    async def test_bulk_tag_validates_task_ownership(self):
        from app.services.tag import bulk_tag
        from fastapi import HTTPException

        db = AsyncMock()
        # task count mismatch
        task_count_result = MagicMock()
        task_count_result.scalar.return_value = 1  # only 1 of 2 tasks owned
        db.execute = AsyncMock(return_value=task_count_result)

        data = BulkTagRequest(task_ids=[1, 2], add_tag_ids=[10])
        with pytest.raises(HTTPException) as exc:
            await bulk_tag(db, user_id=1, data=data)
        assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_bulk_tag_validates_tag_ownership(self):
        from app.services.tag import bulk_tag
        from fastapi import HTTPException

        db = AsyncMock()
        # task count OK
        task_result = MagicMock()
        task_result.scalar.return_value = 2
        # tag count mismatch
        tag_result = MagicMock()
        tag_result.scalar.return_value = 0
        db.execute = AsyncMock(side_effect=[task_result, tag_result])

        data = BulkTagRequest(task_ids=[1, 2], add_tag_ids=[10])
        with pytest.raises(HTTPException) as exc:
            await bulk_tag(db, user_id=1, data=data)
        assert exc.value.status_code == 400


# ── Model tests ──────────────────────────────────────────────────────────────


class TestTagModels:
    def test_tag_model_fields(self):
        tag = make_tag(tag_id=1, user_id=2, name="urgent", color="#ff5500")
        assert tag.id == 1
        assert tag.user_id == 2
        assert tag.name == "urgent"
        assert tag.color == "#ff5500"
        assert tag.created_at is not None

    def test_task_tag_model(self):
        tt = TaskTag()
        tt.task_id = 10
        tt.tag_id = 20
        assert tt.task_id == 10
        assert tt.tag_id == 20

    def test_tag_importable_from_models(self):
        from app.models import Tag, TaskTag
        assert Tag is not None
        assert TaskTag is not None

    def test_task_has_tags_relationship(self):
        """Task model should have tags relationship attribute."""
        t = Task()
        assert hasattr(t, "tags")
