"""
Regression tests for task updates (activity timeline) — author loading.

Bug #309: all activity entries showed "System" because the author relationship
was not defined on TaskUpdate and not eagerly loaded.
"""
from __future__ import annotations

from app.models.task import TaskUpdate, UpdateType
from app.models.user import User, UserRole
from app.schemas.task import TaskUpdateResponse


def make_user(user_id: int = 1) -> User:
    u = User()
    u.id = user_id
    u.role = UserRole.member
    u.email = f"user{user_id}@example.com"
    u.display_name = f"User {user_id}"
    return u


def make_update(update_id: int = 1, task_id: int = 1, author: User | None = None) -> TaskUpdate:
    u = TaskUpdate()
    u.id = update_id
    u.task_id = task_id
    u.author_id = author.id if author else 1
    u.type = UpdateType.comment
    u.content = "test comment"
    u.old_status = None
    u.new_status = None
    u.progress_percent = None
    u.created_at = "2026-03-10T12:00:00+00:00"
    u.author = author
    return u


class TestTaskUpdateAuthorSerialization:
    """Verify that TaskUpdateResponse includes author data when available."""

    def test_author_is_populated_in_response(self):
        """Regression: author must not be None when relationship is loaded."""
        user = make_user(user_id=42)
        update = make_update(author=user)

        response = TaskUpdateResponse.model_validate(update)

        assert response.author is not None
        assert response.author.display_name == "User 42"
        assert response.author.id == 42

    def test_author_none_when_not_loaded(self):
        """When author relationship is not loaded, author should be None."""
        update = make_update(author=None)
        update.author = None

        response = TaskUpdateResponse.model_validate(update)

        assert response.author is None

    def test_multiple_updates_have_correct_authors(self):
        """Each update should show its own author, not a shared fallback."""
        user1 = make_user(user_id=1)
        user2 = make_user(user_id=2)

        update1 = make_update(update_id=1, author=user1)
        update2 = make_update(update_id=2, author=user2)

        resp1 = TaskUpdateResponse.model_validate(update1)
        resp2 = TaskUpdateResponse.model_validate(update2)

        assert resp1.author.display_name == "User 1"
        assert resp2.author.display_name == "User 2"


class TestTaskUpdateModelRelationship:
    """Verify that TaskUpdate model has author relationship defined."""

    def test_author_relationship_exists(self):
        """TaskUpdate must have an 'author' relationship attribute."""
        from sqlalchemy import inspect
        mapper = inspect(TaskUpdate)
        relationship_names = [r.key for r in mapper.relationships]
        assert "author" in relationship_names, (
            "TaskUpdate model must define an 'author' relationship"
        )
