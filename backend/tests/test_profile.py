"""Tests for UserProfile CRUD + import."""
from __future__ import annotations

import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from app.models.profile import UserProfile
from app.models.user import User, UserRole
from app.models.settings import UserSettings
from app.schemas.profile import ProfileUpdate
from app.services.profile import get_profile, upsert_profile, import_profile_from_text


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_user(user_id: int = 1, role: UserRole = UserRole.member) -> User:
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


def make_profile(user_id: int = 1) -> UserProfile:
    p = UserProfile()
    p.id = 1
    p.user_id = user_id
    p.summary = "Experienced engineer"
    p.skills = [{"name": "Python", "level": "expert", "years": 5}]
    p.experience = [{"title": "Senior Dev", "company": "Acme", "start_date": "2020-01"}]
    p.education = [{"degree": "BS CS", "institution": "MIT", "year": 2015}]
    p.contacts = {"email": "test@example.com", "location": "Remote"}
    p.raw_import = None
    p.created_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
    p.updated_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
    return p


def make_settings(user_id: int = 1) -> UserSettings:
    s = UserSettings()
    s.id = 1
    s.user_id = user_id
    s.default_location = None
    s.target_roles = []
    s.min_match_score = 0
    s.excluded_companies = []
    s.stale_threshold_days = 14
    s.llm_provider = "openai"
    s.api_key_openai = "encrypted_key"
    s.api_key_anthropic = None
    s.api_key_gemini = None
    s.api_key_adzuna_id = None
    s.api_key_adzuna_key = None
    s.api_key_serpapi = None
    s.api_key_jsearch = None
    s.google_client_id = None
    s.google_client_secret = None
    s.google_redirect_uri = None
    s.instruction_resume = None
    s.instruction_ats_audit = None
    s.instruction_gap_analysis = None
    s.instruction_cover_letter = None
    s.updated_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
    return s


# ---------------------------------------------------------------------------
# get_profile
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_profile_returns_profile():
    user = make_user()
    profile = make_profile()

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = profile
    mock_db.execute.return_value = mock_result

    result = await get_profile(mock_db, user)
    assert result is not None
    assert result.summary == "Experienced engineer"
    assert result.user_id == 1


@pytest.mark.asyncio
async def test_get_profile_returns_none_when_not_found():
    user = make_user()

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_db.execute.return_value = mock_result

    result = await get_profile(mock_db, user)
    assert result is None


# ---------------------------------------------------------------------------
# upsert_profile
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_upsert_profile_creates_when_missing():
    user = make_user()

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_db.execute.return_value = mock_result
    mock_db.add = MagicMock()
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    data = ProfileUpdate(summary="New summary", skills=[{"name": "Go"}])
    result = await upsert_profile(mock_db, user, data)

    # Should have called db.add for new profile
    mock_db.add.assert_called_once()
    mock_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_upsert_profile_updates_existing():
    user = make_user()
    profile = make_profile()

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = profile
    mock_db.execute.return_value = mock_result
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    data = ProfileUpdate(summary="Updated summary")
    result = await upsert_profile(mock_db, user, data)

    assert result.summary == "Updated summary"
    # Should NOT have called db.add (existing profile)
    mock_db.add.assert_not_called()


# ---------------------------------------------------------------------------
# import_profile_from_text
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_import_profile_parses_text_via_llm():
    user = make_user()
    settings = make_settings()

    llm_response = '''{
        "summary": "Senior Python developer",
        "skills": [{"name": "Python", "level": "expert", "years": 8}],
        "experience": [{"title": "Lead Dev", "company": "TechCo", "start_date": "2018-01"}],
        "education": [{"degree": "MS CS", "institution": "Stanford", "year": 2017}],
        "contacts": {"email": "dev@example.com", "linkedin": "linkedin.com/in/dev"}
    }'''

    mock_db = AsyncMock()

    # First execute: get_or_create_settings
    mock_settings_result = MagicMock()
    mock_settings_result.scalar_one_or_none.return_value = settings

    # Second execute: get_profile (check existing)
    mock_profile_result = MagicMock()
    mock_profile_result.scalar_one_or_none.return_value = None

    mock_db.execute.side_effect = [mock_settings_result, mock_profile_result]
    mock_db.add = MagicMock()
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    mock_llm = MagicMock()
    mock_llm.generate = AsyncMock(return_value=llm_response)

    with patch("app.services.profile.get_decrypted_key", return_value="real-api-key"), \
         patch("app.services.profile.get_llm_client", return_value=mock_llm):
        result = await import_profile_from_text(mock_db, user, "My resume text here...")

    assert result.summary == "Senior Python developer"
    assert result.raw_import == "My resume text here..."
    mock_llm.generate.assert_awaited_once()


@pytest.mark.asyncio
async def test_import_profile_raises_when_no_api_key():
    user = make_user()
    settings = make_settings()
    settings.api_key_openai = None

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = settings
    mock_db.execute.return_value = mock_result

    with patch("app.services.profile.get_decrypted_key", return_value=None):
        with pytest.raises(ValueError, match="No API key"):
            await import_profile_from_text(mock_db, user, "text")
