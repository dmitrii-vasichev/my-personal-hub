"""
Tests for multi-tag filtering in task service (Phase 31).
Verifies tag_ids parsing and SQL query construction.
"""
from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, MagicMock

from app.models.user import User, UserRole
from app.services.task import list_tasks


def make_admin(user_id: int = 1) -> User:
    u = User()
    u.id = user_id
    u.role = UserRole.admin
    u.email = "admin@example.com"
    u.display_name = "Admin"
    return u


def _mock_db_returning(tasks: list):
    """Create a mock AsyncSession that returns the given tasks."""
    db = AsyncMock()
    scalars = MagicMock()
    scalars.all.return_value = tasks
    unique = MagicMock()
    unique.scalars.return_value = scalars
    result = MagicMock()
    result.unique.return_value = unique
    db.execute = AsyncMock(return_value=result)
    return db


@pytest.mark.asyncio
async def test_no_tag_ids_returns_all():
    """When tag_ids is None, no tag filtering is applied."""
    db = _mock_db_returning([])
    user = make_admin()

    await list_tasks(db, user, tag_ids=None)

    call_args = db.execute.call_args
    query_str = str(call_args[0][0])
    assert "task_tags" not in query_str.lower()


@pytest.mark.asyncio
async def test_single_tag_id_filters():
    """When tag_ids='5', filter by tag 5."""
    db = _mock_db_returning([])
    user = make_admin()

    await list_tasks(db, user, tag_ids="5")

    call_args = db.execute.call_args
    query_str = str(call_args[0][0])
    assert "task_tags" in query_str.lower()


@pytest.mark.asyncio
async def test_multiple_tag_ids_filters():
    """When tag_ids='5,8', filter by tags 5 OR 8."""
    db = _mock_db_returning([])
    user = make_admin()

    await list_tasks(db, user, tag_ids="5,8")

    call_args = db.execute.call_args
    query_str = str(call_args[0][0])
    assert "task_tags" in query_str.lower()


@pytest.mark.asyncio
async def test_untagged_only_filters():
    """When tag_ids='untagged', filter for tasks with no tags."""
    db = _mock_db_returning([])
    user = make_admin()

    await list_tasks(db, user, tag_ids="untagged")

    call_args = db.execute.call_args
    query_str = str(call_args[0][0])
    # Should have NOT IN subquery for untagged
    assert "task_tags" in query_str.lower()


@pytest.mark.asyncio
async def test_tag_ids_plus_untagged():
    """When tag_ids='5,untagged', filter by tag 5 OR untagged."""
    db = _mock_db_returning([])
    user = make_admin()

    await list_tasks(db, user, tag_ids="5,untagged")

    call_args = db.execute.call_args
    query_str = str(call_args[0][0])
    assert "task_tags" in query_str.lower()


@pytest.mark.asyncio
async def test_empty_tag_ids_string():
    """When tag_ids is empty string, treat as no filtering."""
    db = _mock_db_returning([])
    user = make_admin()

    await list_tasks(db, user, tag_ids="")

    call_args = db.execute.call_args
    query_str = str(call_args[0][0])
    # Empty string has no valid parts, so no conditions added
    assert "task_tags" not in query_str.lower()
