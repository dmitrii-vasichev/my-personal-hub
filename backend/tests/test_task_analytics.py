"""
Unit tests for task analytics service — mocked DB.
"""
import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock

from app.models.task import TaskPriority, TaskStatus
from app.models.user import User, UserRole
from app.services import task_analytics as svc


def make_user(user_id: int = 1) -> User:
    u = User()
    u.id = user_id
    u.role = UserRole.member
    u.email = f"user{user_id}@example.com"
    u.display_name = f"User {user_id}"
    return u


def make_row(**kwargs):
    row = MagicMock()
    for k, v in kwargs.items():
        setattr(row, k, v)
    return row


@pytest.mark.asyncio
async def test_status_distribution_all_statuses():
    """Returns all statuses, zeroing missing ones."""
    db = AsyncMock()
    result = MagicMock()
    result.all.return_value = [
        make_row(status=TaskStatus.new, count=5),
        make_row(status=TaskStatus.done, count=3),
    ]
    db.execute = AsyncMock(return_value=result)

    user = make_user()
    data = await svc.get_status_distribution(db, user)

    statuses = {d["status"]: d["count"] for d in data}
    assert statuses["new"] == 5
    assert statuses["done"] == 3
    assert statuses["in_progress"] == 0
    assert statuses["cancelled"] == 0
    assert len(data) == len(TaskStatus)


@pytest.mark.asyncio
async def test_priority_distribution_all_priorities():
    """Returns all priorities."""
    db = AsyncMock()
    result = MagicMock()
    result.all.return_value = [
        make_row(priority=TaskPriority.high, count=4),
        make_row(priority=TaskPriority.medium, count=6),
    ]
    db.execute = AsyncMock(return_value=result)

    user = make_user()
    data = await svc.get_priority_distribution(db, user)

    priorities = {d["priority"]: d["count"] for d in data}
    assert priorities["high"] == 4
    assert priorities["medium"] == 6
    assert priorities["urgent"] == 0
    assert len(data) == len(TaskPriority)


@pytest.mark.asyncio
async def test_overdue_empty():
    """Returns count 0 and empty list when no overdue tasks."""
    db = AsyncMock()
    result = MagicMock()
    result.all.return_value = []
    db.execute = AsyncMock(return_value=result)

    user = make_user()
    data = await svc.get_overdue(db, user)

    assert data["count"] == 0
    assert data["tasks"] == []


@pytest.mark.asyncio
async def test_overdue_with_tasks():
    """Returns correct count and task list."""
    db = AsyncMock()
    now = datetime.now(tz=timezone.utc)
    result = MagicMock()
    result.all.return_value = [
        make_row(
            id=1,
            title="Fix bug",
            deadline=now - timedelta(days=2),
            priority=TaskPriority.high,
        ),
        make_row(
            id=2,
            title="Write tests",
            deadline=now - timedelta(hours=3),
            priority=TaskPriority.medium,
        ),
    ]
    db.execute = AsyncMock(return_value=result)

    user = make_user()
    data = await svc.get_overdue(db, user)

    assert data["count"] == 2
    assert data["tasks"][0]["id"] == 1
    assert data["tasks"][0]["title"] == "Fix bug"
    assert data["tasks"][0]["priority"] == "high"
    assert "deadline" in data["tasks"][0]


@pytest.mark.asyncio
async def test_completion_rate_empty():
    """Returns 12 weeks of zero-data when no tasks."""
    db = AsyncMock()
    empty_result = MagicMock()
    empty_result.scalars.return_value.all.return_value = []
    db.execute = AsyncMock(return_value=empty_result)

    user = make_user()
    data = await svc.get_completion_rate(db, user, weeks=12)

    assert len(data) == 12
    for point in data:
        assert point["created"] == 0
        assert point["done"] == 0
        assert point["rate"] == 0.0
