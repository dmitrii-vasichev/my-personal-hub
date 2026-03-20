"""
Regression tests for #734: demo user data must not leak to real users.
Covers: _can_access_task, _can_access_event with family visibility.
"""
from __future__ import annotations

import pytest
from datetime import datetime, timezone

from app.models.task import Task, TaskStatus, TaskPriority, Visibility
from app.models.calendar import CalendarEvent
from app.models.user import User, UserRole
from app.services.task import _can_access_task
from app.services.calendar import _can_access_event


# ── Helpers ──────────────────────────────────────────────────────────────────


def _make_user(user_id: int, role: UserRole = UserRole.member) -> User:
    u = User()
    u.id = user_id
    u.role = role
    u.email = f"user{user_id}@example.com"
    u.display_name = f"User {user_id}"
    u.is_blocked = False
    u.must_change_password = False
    u.theme = "dark"
    u.created_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
    return u


def _make_task(
    task_id: int,
    owner: User,
    visibility: Visibility = Visibility.private,
    assignee_id: int | None = None,
) -> Task:
    t = Task()
    t.id = task_id
    t.user_id = owner.id
    t.created_by_id = owner.id
    t.assignee_id = assignee_id or owner.id
    t.title = f"Task {task_id}"
    t.description = ""
    t.status = TaskStatus.new
    t.priority = TaskPriority.medium
    t.visibility = visibility
    t.owner = owner
    return t


def _make_event(
    event_id: int,
    owner: User,
    visibility: Visibility = Visibility.private,
) -> CalendarEvent:
    e = CalendarEvent()
    e.id = event_id
    e.user_id = owner.id
    e.title = f"Event {event_id}"
    e.visibility = visibility
    e.owner = owner
    return e


# ── Task isolation ───────────────────────────────────────────────────────────


class TestDemoTaskIsolation:
    """Member users must never see demo user's tasks."""

    def test_member_cannot_see_demo_private_task(self):
        demo = _make_user(99, UserRole.demo)
        member = _make_user(1, UserRole.member)
        task = _make_task(1, owner=demo, visibility=Visibility.private)
        assert _can_access_task(task, member) is False

    def test_member_cannot_see_demo_family_task(self):
        """Core regression: family-visible demo task must NOT leak."""
        demo = _make_user(99, UserRole.demo)
        member = _make_user(1, UserRole.member)
        task = _make_task(1, owner=demo, visibility=Visibility.family)
        assert _can_access_task(task, member) is False

    def test_member_can_see_own_family_task(self):
        member = _make_user(1, UserRole.member)
        task = _make_task(1, owner=member, visibility=Visibility.family)
        assert _can_access_task(task, member) is True

    def test_member_can_see_other_member_family_task(self):
        member_a = _make_user(1, UserRole.member)
        member_b = _make_user(2, UserRole.member)
        task = _make_task(1, owner=member_a, visibility=Visibility.family)
        assert _can_access_task(task, member_b) is True

    def test_admin_can_see_demo_family_task(self):
        demo = _make_user(99, UserRole.demo)
        admin = _make_user(1, UserRole.admin)
        task = _make_task(1, owner=demo, visibility=Visibility.family)
        assert _can_access_task(task, admin) is True

    def test_demo_can_see_own_task(self):
        demo = _make_user(99, UserRole.demo)
        task = _make_task(1, owner=demo, visibility=Visibility.private)
        assert _can_access_task(task, demo) is True

    def test_demo_cannot_see_member_task(self):
        demo = _make_user(99, UserRole.demo)
        member = _make_user(1, UserRole.member)
        task = _make_task(1, owner=member, visibility=Visibility.family)
        assert _can_access_task(task, demo) is False

    def test_member_can_see_assigned_task(self):
        member_a = _make_user(1, UserRole.member)
        member_b = _make_user(2, UserRole.member)
        task = _make_task(1, owner=member_a, visibility=Visibility.private, assignee_id=2)
        assert _can_access_task(task, member_b) is True


# ── Event isolation ──────────────────────────────────────────────────────────


class TestDemoEventIsolation:
    """Member users must never see demo user's calendar events."""

    def test_member_cannot_see_demo_private_event(self):
        demo = _make_user(99, UserRole.demo)
        member = _make_user(1, UserRole.member)
        event = _make_event(1, owner=demo, visibility=Visibility.private)
        assert _can_access_event(event, member) is False

    def test_member_cannot_see_demo_family_event(self):
        """Core regression: family-visible demo event must NOT leak."""
        demo = _make_user(99, UserRole.demo)
        member = _make_user(1, UserRole.member)
        event = _make_event(1, owner=demo, visibility=Visibility.family)
        assert _can_access_event(event, member) is False

    def test_member_can_see_own_family_event(self):
        member = _make_user(1, UserRole.member)
        event = _make_event(1, owner=member, visibility=Visibility.family)
        assert _can_access_event(event, member) is True

    def test_member_can_see_other_member_family_event(self):
        member_a = _make_user(1, UserRole.member)
        member_b = _make_user(2, UserRole.member)
        event = _make_event(1, owner=member_a, visibility=Visibility.family)
        assert _can_access_event(event, member_b) is True

    def test_admin_can_see_demo_family_event(self):
        demo = _make_user(99, UserRole.demo)
        admin = _make_user(1, UserRole.admin)
        event = _make_event(1, owner=demo, visibility=Visibility.family)
        assert _can_access_event(event, admin) is True
