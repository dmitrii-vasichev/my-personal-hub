"""
Tests for Phase 14: Settings Tabs & Google Calendar Integration Config.
Covers: Google OAuth credentials in settings, DB-first credential resolution.
"""
from __future__ import annotations

import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from app.models.user import User, UserRole
from app.models.settings import UserSettings
from app.schemas.settings import SettingsUpdate, SettingsResponse
from app.services.settings import (
    to_response,
    to_member_response,
    update_settings,
    get_google_oauth_credentials,
    get_decrypted_key,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_user(
    user_id: int = 1,
    role: UserRole = UserRole.member,
) -> User:
    u = User()
    u.id = user_id
    u.email = f"user{user_id}@example.com"
    u.display_name = f"User {user_id}"
    u.password_hash = "hashed"
    u.role = role
    u.must_change_password = False
    u.is_blocked = False
    u.theme = "dark"
    u.last_login_at = None
    u.created_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
    return u


def make_admin(user_id: int = 99) -> User:
    return make_user(user_id=user_id, role=UserRole.admin)


def make_settings(
    user_id: int = 1,
    google_client_id: str | None = None,
    google_client_secret: str | None = None,
    google_redirect_uri: str | None = None,
) -> UserSettings:
    s = UserSettings()
    s.id = 1
    s.user_id = user_id
    s.default_location = "Remote"
    s.target_roles = ["Backend Engineer"]
    s.min_match_score = 70
    s.excluded_companies = []
    s.stale_threshold_days = 30
    s.llm_provider = "openai"
    s.api_key_openai = None
    s.api_key_anthropic = None
    s.api_key_gemini = None
    s.api_key_adzuna_id = None
    s.api_key_adzuna_key = None
    s.api_key_serpapi = None
    s.api_key_jsearch = None
    s.google_client_id = google_client_id
    s.google_client_secret = google_client_secret
    s.google_redirect_uri = google_redirect_uri
    s.updated_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
    return s


# ---------------------------------------------------------------------------
# 1. Settings response masks Google keys
# ---------------------------------------------------------------------------

def test_settings_response_masks_google_keys_when_set():
    """SettingsResponse shows has_google_client_id=True but never the actual value."""
    settings = make_settings(
        google_client_id="encrypted_id",
        google_client_secret="encrypted_secret",
        google_redirect_uri="http://localhost:8000/api/calendar/oauth/callback",
    )
    resp = to_response(settings)
    assert isinstance(resp, SettingsResponse)
    assert resp.has_google_client_id is True
    assert resp.has_google_client_secret is True
    assert resp.google_redirect_uri == "http://localhost:8000/api/calendar/oauth/callback"
    # Ensure no plaintext credentials in response
    resp_dict = resp.model_dump()
    assert "google_client_id" not in resp_dict or resp_dict.get("google_client_id") is None
    assert "google_client_secret" not in resp_dict or resp_dict.get("google_client_secret") is None


def test_settings_response_masks_google_keys_when_empty():
    """SettingsResponse shows has_google_client_id=False when not set."""
    settings = make_settings()
    resp = to_response(settings)
    assert resp.has_google_client_id is False
    assert resp.has_google_client_secret is False
    assert resp.google_redirect_uri is None


def test_member_response_excludes_google_fields():
    """MemberSettingsResponse should not expose any Google OAuth information."""
    settings = make_settings(
        google_client_id="encrypted_id",
        google_client_secret="encrypted_secret",
    )
    resp = to_member_response(settings)
    resp_dict = resp.model_dump()
    assert "has_google_client_id" not in resp_dict
    assert "has_google_client_secret" not in resp_dict
    assert "google_redirect_uri" not in resp_dict


# ---------------------------------------------------------------------------
# 2. Admin can save Google credentials (encrypted)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_admin_save_google_credentials():
    """Admin can update google_client_id and google_client_secret — they get encrypted."""
    admin = make_admin()
    settings = make_settings(user_id=admin.id)

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = settings
    mock_db.execute.return_value = mock_result
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    data = SettingsUpdate(
        google_client_id="my-client-id-123",
        google_client_secret="my-client-secret-456",
        google_redirect_uri="http://example.com/callback",
    )

    with patch("app.services.settings.encrypt_value", side_effect=lambda v: f"enc_{v}"):
        result = await update_settings(mock_db, admin, data)

    assert result.google_client_id == "enc_my-client-id-123"
    assert result.google_client_secret == "enc_my-client-secret-456"
    assert result.google_redirect_uri == "http://example.com/callback"


# ---------------------------------------------------------------------------
# 3. Member cannot save Google credentials
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_member_cannot_save_google_credentials():
    """Member's update should silently ignore google_* fields."""
    member = make_user(user_id=2, role=UserRole.member)
    settings = make_settings(user_id=member.id)

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = settings
    mock_db.execute.return_value = mock_result
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    data = SettingsUpdate(
        google_client_id="should-be-ignored",
        google_client_secret="should-be-ignored",
        default_location="Berlin",
    )

    result = await update_settings(mock_db, member, data)

    # google_client_id should NOT have been set
    assert result.google_client_id is None
    assert result.google_client_secret is None
    # But regular fields should be updated
    assert result.default_location == "Berlin"


# ---------------------------------------------------------------------------
# 4. get_google_oauth_credentials returns decrypted values from DB
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_google_oauth_credentials_from_db():
    """When admin has configured Google OAuth in DB, helper returns decrypted values."""
    settings = make_settings(
        user_id=99,
        google_client_id="encrypted_client_id",
        google_client_secret="encrypted_client_secret",
        google_redirect_uri="http://localhost:8000/api/calendar/oauth/callback",
    )

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = settings
    mock_db.execute.return_value = mock_result

    with patch(
        "app.services.settings.decrypt_value",
        side_effect=lambda v: v.replace("encrypted_", "decrypted_"),
    ):
        result = await get_google_oauth_credentials(mock_db)

    assert result is not None
    client_id, client_secret, redirect_uri = result
    assert client_id == "decrypted_client_id"
    assert client_secret == "decrypted_client_secret"
    assert redirect_uri == "http://localhost:8000/api/calendar/oauth/callback"


# ---------------------------------------------------------------------------
# 5. get_google_oauth_credentials returns None when DB is empty
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_google_oauth_credentials_returns_none_when_empty():
    """When no admin has configured Google OAuth, helper returns None."""
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_db.execute.return_value = mock_result

    result = await get_google_oauth_credentials(mock_db)
    assert result is None


# ---------------------------------------------------------------------------
# 6. get_oauth_config falls back to env vars
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_oauth_config_fallback_to_env():
    """When DB has no credentials, get_oauth_config should use env vars."""
    from app.services.google_oauth import get_oauth_config

    mock_db = AsyncMock()

    with patch(
        "app.services.settings.get_google_oauth_credentials",
        new_callable=AsyncMock,
        return_value=None,
    ), patch(
        "app.services.google_oauth.env_settings",
    ) as mock_env:
        mock_env.GOOGLE_CLIENT_ID = "env-client-id"
        mock_env.GOOGLE_CLIENT_SECRET = "env-client-secret"
        mock_env.GOOGLE_REDIRECT_URI = "http://localhost:8000/callback"

        result = await get_oauth_config(mock_db)

    assert result == ("env-client-id", "env-client-secret", "http://localhost:8000/callback")


@pytest.mark.asyncio
async def test_get_oauth_config_db_takes_priority():
    """When DB has credentials, they take priority over env vars."""
    from app.services.google_oauth import get_oauth_config

    mock_db = AsyncMock()

    with patch(
        "app.services.settings.get_google_oauth_credentials",
        new_callable=AsyncMock,
        return_value=("db-client-id", "db-client-secret", "http://db-redirect.com/callback"),
    ), patch(
        "app.services.google_oauth.env_settings",
    ) as mock_env:
        mock_env.GOOGLE_CLIENT_ID = "env-client-id"
        mock_env.GOOGLE_CLIENT_SECRET = "env-client-secret"
        mock_env.GOOGLE_REDIRECT_URI = "http://env-redirect.com/callback"

        result = await get_oauth_config(mock_db)

    assert result == ("db-client-id", "db-client-secret", "http://db-redirect.com/callback")


@pytest.mark.asyncio
async def test_get_oauth_config_raises_when_both_empty():
    """When neither DB nor env have credentials, raise ValueError."""
    from app.services.google_oauth import get_oauth_config

    mock_db = AsyncMock()

    with patch(
        "app.services.settings.get_google_oauth_credentials",
        new_callable=AsyncMock,
        return_value=None,
    ), patch(
        "app.services.google_oauth.env_settings",
    ) as mock_env:
        mock_env.GOOGLE_CLIENT_ID = ""
        mock_env.GOOGLE_CLIENT_SECRET = ""
        mock_env.GOOGLE_REDIRECT_URI = ""

        with pytest.raises(ValueError, match="not configured"):
            await get_oauth_config(mock_db)
