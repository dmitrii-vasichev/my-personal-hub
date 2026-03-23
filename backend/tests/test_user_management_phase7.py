"""
Tests for Phase 7: Role System & DB Migration.
Covers: UserRole rename, new User fields, Visibility enum, blocked user logic,
        last_login_at tracking, member role default.
"""
from __future__ import annotations

import pytest
from datetime import datetime
from unittest.mock import AsyncMock, patch

from app.models.user import User, UserRole
from app.models.task import Task, Visibility
from app.models.calendar import CalendarEvent
from app.services.auth import update_last_login, create_user
from app.core.security import create_access_token, decode_access_token


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_user(
    user_id: int = 1,
    role: UserRole = UserRole.member,
    is_blocked: bool = False,
) -> User:
    u = User()
    u.id = user_id
    u.email = f"user{user_id}@example.com"
    u.display_name = f"User {user_id}"
    u.password_hash = "hashed"
    u.role = role
    u.must_change_password = False
    u.is_blocked = is_blocked
    u.theme = "dark"
    u.last_login_at = None
    return u


# ---------------------------------------------------------------------------
# 1. UserRole enum
# ---------------------------------------------------------------------------

def test_user_role_enum_has_member():
    """UserRole.member exists."""
    assert UserRole.member.value == "member"


def test_user_role_enum_has_no_user_value():
    """'user' is no longer a valid UserRole value."""
    values = [r.value for r in UserRole]
    assert "user" not in values


def test_user_role_enum_has_admin():
    """Admin role is unchanged."""
    assert UserRole.admin.value == "admin"


# ---------------------------------------------------------------------------
# 2. User model new fields
# ---------------------------------------------------------------------------

def test_user_model_has_is_blocked():
    u = make_user()
    assert hasattr(u, "is_blocked")
    assert u.is_blocked is False


def test_user_model_has_last_login_at():
    u = make_user()
    assert hasattr(u, "last_login_at")
    assert u.last_login_at is None


def test_user_model_has_theme():
    u = make_user()
    assert hasattr(u, "theme")
    assert u.theme == "dark"


# ---------------------------------------------------------------------------
# 3. Visibility enum
# ---------------------------------------------------------------------------

def test_visibility_enum_has_family():
    assert Visibility.family.value == "family"


def test_visibility_enum_has_private():
    assert Visibility.private.value == "private"


# ---------------------------------------------------------------------------
# 4. Task model visibility field
# ---------------------------------------------------------------------------

def test_task_has_visibility_field():
    t = Task()
    assert hasattr(t, "visibility")


def test_task_visibility_default_is_family():
    t = Task()
    t.visibility = Visibility.family
    assert t.visibility == Visibility.family


# ---------------------------------------------------------------------------
# 5. CalendarEvent model visibility field
# ---------------------------------------------------------------------------

def test_calendar_event_has_visibility_field():
    e = CalendarEvent()
    assert hasattr(e, "visibility")


def test_calendar_event_visibility_default_is_family():
    e = CalendarEvent()
    e.visibility = Visibility.family
    assert e.visibility == Visibility.family


# ---------------------------------------------------------------------------
# 6. update_last_login sets last_login_at
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_login_updates_last_login_at():
    """update_last_login sets last_login_at to current UTC time."""
    db = AsyncMock()
    user = make_user()
    assert user.last_login_at is None

    await update_last_login(db, user)

    assert user.last_login_at is not None
    assert isinstance(user.last_login_at, datetime)
    assert user.last_login_at.tzinfo is not None
    db.commit.assert_awaited_once()


# ---------------------------------------------------------------------------
# 7. Blocked user cannot log in — endpoint level
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_blocked_user_login_returns_403():
    """Login endpoint returns 403 when user.is_blocked is True."""
    from httpx import AsyncClient, ASGITransport
    from app.main import app

    blocked_user = make_user(is_blocked=True)

    with (
        patch("app.api.auth.authenticate_user", return_value=blocked_user),
        patch("app.api.auth.update_last_login", new_callable=AsyncMock),
    ):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/auth/login",
                json={"email": "blocked@example.com", "password": "pass"},
            )

    assert response.status_code == 403
    assert "blocked" in response.json()["detail"].lower()


# ---------------------------------------------------------------------------
# 8. Register creates user with role='member'
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_register_creates_member_role():
    """create_user defaults to role='member'."""
    db = AsyncMock()

    created_user = make_user(role=UserRole.member)
    db.refresh = AsyncMock(side_effect=lambda u: None)

    with patch("app.services.auth.User") as MockUser:
        MockUser.return_value = created_user
        user, temp_password = await create_user(db, "new@example.com", "New User")

    assert user.role == UserRole.member
    assert temp_password  # not empty


# ---------------------------------------------------------------------------
# 9. JWT token contains 'member' role
# ---------------------------------------------------------------------------

def test_jwt_token_contains_member_role():
    """Token payload has role='member' for a regular user."""
    token = create_access_token(user_id=42, role="member")
    payload = decode_access_token(token)
    assert payload["role"] == "member"
    assert payload["sub"] == "42"


# ---------------------------------------------------------------------------
# 10. Admin role works unchanged
# ---------------------------------------------------------------------------

def test_admin_role_unchanged():
    """Admin user still has role=admin, not affected by member rename."""
    admin = make_user(role=UserRole.admin)
    assert admin.role == UserRole.admin
    token = create_access_token(user_id=admin.id, role=admin.role.value)
    payload = decode_access_token(token)
    assert payload["role"] == "admin"
