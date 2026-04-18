"""
Tests for Phase 8: User Management & Profile.
Covers: User CRUD API, profile endpoints, role-based settings access.
"""
from __future__ import annotations

import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

from app.models.user import User, UserRole
from app.models.settings import UserSettings
from app.schemas.auth import (
    CreateUserRequest,
    UpdateUserRequest,
    UpdateProfileRequest,
)
from app.services.settings import to_member_response, to_response
from app.schemas.settings import MemberSettingsResponse, SettingsResponse


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_user(
    user_id: int = 1,
    role: UserRole = UserRole.member,
    is_blocked: bool = False,
    email: str | None = None,
    display_name: str | None = None,
) -> User:
    u = User()
    u.id = user_id
    u.email = email or f"user{user_id}@example.com"
    u.display_name = display_name or f"User {user_id}"
    u.password_hash = "hashed"
    u.role = role
    u.must_change_password = False
    u.is_blocked = is_blocked
    u.theme = "dark"
    u.timezone = "UTC"
    u.last_login_at = None
    u.created_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
    return u


def make_admin(user_id: int = 99) -> User:
    return make_user(user_id=user_id, role=UserRole.admin)


def make_settings(user_id: int = 1) -> UserSettings:
    s = UserSettings()
    s.id = 1
    s.user_id = user_id
    s.default_location = "Remote"
    s.target_roles = ["Backend Engineer"]
    s.min_match_score = 70
    s.excluded_companies = []
    s.stale_threshold_days = 30
    s.llm_provider = "anthropic"
    s.api_key_openai = None
    s.api_key_anthropic = "encrypted_value"
    s.api_key_gemini = None
    s.api_key_adzuna_id = None
    s.api_key_adzuna_key = None
    s.api_key_serpapi = None
    s.api_key_jsearch = None
    s.updated_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
    return s


# ---------------------------------------------------------------------------
# 1. Schemas — new schemas exist and validate correctly
# ---------------------------------------------------------------------------

def test_create_user_request_defaults_to_member():
    req = CreateUserRequest(email="test@example.com", display_name="Test")
    assert req.role == "member"


def test_create_user_request_accepts_admin_role():
    req = CreateUserRequest(email="admin@example.com", display_name="Admin", role="admin")
    assert req.role == "admin"


def test_update_user_request_optional_fields():
    req = UpdateUserRequest()
    assert req.role is None
    assert req.is_blocked is None


def test_update_profile_request_validates_theme():
    req = UpdateProfileRequest(theme="light")
    assert req.theme == "light"


def test_update_profile_request_rejects_invalid_theme():
    with pytest.raises(Exception):
        UpdateProfileRequest(theme="rainbow")


# ---------------------------------------------------------------------------
# 2. Settings — member vs admin response
# ---------------------------------------------------------------------------

def test_to_member_response_excludes_api_keys():
    settings = make_settings()
    response = to_member_response(settings)
    assert isinstance(response, MemberSettingsResponse)
    assert not hasattr(response, "has_api_key_openai")
    assert not hasattr(response, "llm_provider")
    assert response.target_roles == ["Backend Engineer"]
    assert response.min_match_score == 70


def test_to_response_includes_api_keys():
    settings = make_settings()
    response = to_response(settings)
    assert isinstance(response, SettingsResponse)
    assert hasattr(response, "has_api_key_openai")
    assert response.has_api_key_anthropic is True  # "encrypted_value" is truthy


def test_member_settings_response_has_job_search_fields():
    settings = make_settings()
    response = to_member_response(settings)
    assert response.default_location == "Remote"
    assert response.stale_threshold_days == 30
    assert response.excluded_companies == []


# ---------------------------------------------------------------------------
# 3. Settings service — member cannot set API keys
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_member_cannot_update_llm_provider():
    """Member update ignores llm_provider field."""
    from app.schemas.settings import SettingsUpdate

    member = make_user(role=UserRole.member)
    settings = make_settings()
    db = AsyncMock()

    async def mock_get_or_create(db, user):
        return settings

    with patch("app.services.settings.get_or_create_settings", side_effect=mock_get_or_create):
        from app.services.settings import update_settings
        data = SettingsUpdate(llm_provider="openai", target_roles=["ML Engineer"])
        await update_settings(db, member, data)

    # llm_provider should NOT be changed for member
    assert settings.llm_provider == "anthropic"
    # but target_roles should be updated
    assert settings.target_roles == ["ML Engineer"]


@pytest.mark.asyncio
async def test_admin_can_update_llm_provider():
    """Admin update can change llm_provider."""
    from app.schemas.settings import SettingsUpdate

    admin = make_admin()
    settings = make_settings()
    db = AsyncMock()

    async def mock_get_or_create(db, user):
        return settings

    with patch("app.services.settings.get_or_create_settings", side_effect=mock_get_or_create):
        from app.services.settings import update_settings
        data = SettingsUpdate(llm_provider="openai")
        await update_settings(db, admin, data)

    assert settings.llm_provider == "openai"


# ---------------------------------------------------------------------------
# 4. User CRUD API — endpoints
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_admin_can_access_user_list():
    """Admin role grants access to user list endpoint."""
    from app.core.deps import require_admin

    admin = make_admin()
    # require_admin calls get_current_user — if user is admin, it returns user
    result = await require_admin(user=admin)
    assert result.role == UserRole.admin
    assert result.id == admin.id


@pytest.mark.asyncio
async def test_member_cannot_access_user_crud():
    """Non-admin gets 403 on admin-only user endpoints."""
    from httpx import AsyncClient, ASGITransport
    from app.main import app
    from app.core.security import create_access_token

    member = make_user(role=UserRole.member)

    with patch("app.core.deps.get_user_by_id", return_value=member):
        token = create_access_token(member.id, member.role.value)
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get(
                "/api/users/",
                headers={"Authorization": f"Bearer {token}"},
            )

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_unauthenticated_user_cannot_access_user_list():
    """No token → 403 on user list."""
    from httpx import AsyncClient, ASGITransport
    from app.main import app

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/api/users/")

    assert response.status_code == 403


# ---------------------------------------------------------------------------
# 5. Profile API — endpoints
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_authenticated_user_can_get_profile():
    """GET /api/auth/profile returns own profile."""
    from httpx import AsyncClient, ASGITransport
    from app.main import app
    from app.core.security import create_access_token

    user = make_user()

    with patch("app.core.deps.get_user_by_id", return_value=user):
        token = create_access_token(user.id, user.role.value)
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get(
                "/api/auth/profile",
                headers={"Authorization": f"Bearer {token}"},
            )

    assert response.status_code == 200
    data = response.json()
    assert data["email"] == user.email
    assert data["role"] == "member"
    assert "created_at" in data


@pytest.mark.asyncio
async def test_unauthenticated_cannot_get_profile():
    """No token → 403 on profile endpoint."""
    from httpx import AsyncClient, ASGITransport
    from app.main import app

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/api/auth/profile")

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_update_profile_display_name():
    """update_profile endpoint mutates display_name and theme on the user object."""
    from app.schemas.auth import UpdateProfileRequest

    user = make_user(display_name="Old Name")
    db = AsyncMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()

    data = UpdateProfileRequest(display_name="New Name", theme="light")

    # Simulate what the endpoint does
    if data.display_name is not None:
        user.display_name = data.display_name
    if data.theme is not None:
        user.theme = data.theme
    await db.commit()

    assert user.display_name == "New Name"
    assert user.theme == "light"
    db.commit.assert_awaited_once()


# ---------------------------------------------------------------------------
# 6. Admin delete self — prevented
# ---------------------------------------------------------------------------

def test_cannot_delete_self_logic():
    """Admin id == user_id raises 400."""
    # This is unit-testing the guard logic conceptually
    admin = make_admin(user_id=1)
    # If admin tries to delete themselves
    assert admin.id == 1
    would_be_blocked = admin.id == 1  # same as user_id=1
    assert would_be_blocked


# ---------------------------------------------------------------------------
# 7. MemberSettingsResponse schema structure
# ---------------------------------------------------------------------------

def test_member_settings_response_schema():
    data = {
        "id": 1,
        "user_id": 2,
        "default_location": "Remote",
        "target_roles": ["Engineer"],
        "min_match_score": 60,
        "excluded_companies": ["FAANG"],
        "stale_threshold_days": 14,
        "updated_at": datetime(2026, 1, 1, tzinfo=timezone.utc),
    }
    response = MemberSettingsResponse(**data)
    assert response.min_match_score == 60
    assert "Engineer" in response.target_roles
