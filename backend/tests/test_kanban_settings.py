"""
Tests for Phase 26: Kanban Board UX Improvements — backend.
Covers: kanban_hidden_columns in UserSettings model, schema, and service.
"""
from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models.settings import UserSettings
from app.models.user import User, UserRole
from app.schemas.settings import SettingsResponse, SettingsUpdate
from app.services.settings import to_response, update_settings


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_user(user_id: int = 1, role: UserRole = UserRole.admin) -> User:
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


def make_settings(user_id: int = 1, kanban_hidden_columns: list | None = None) -> UserSettings:
    s = UserSettings()
    s.id = 1
    s.user_id = user_id
    s.default_location = "Remote"
    s.target_roles = ["Engineer"]
    s.min_match_score = 0
    s.excluded_companies = []
    s.stale_threshold_days = 14
    s.llm_provider = "openai"
    s.api_key_openai = None
    s.api_key_anthropic = None
    s.api_key_gemini = None
    s.api_key_adzuna_id = None
    s.api_key_adzuna_key = None
    s.api_key_serpapi = None
    s.api_key_jsearch = None
    s.google_client_id = None
    s.google_client_secret = None
    s.google_redirect_uri = None
    s.google_drive_notes_folder_id = None
    s.instruction_resume = None
    s.instruction_ats_audit = None
    s.instruction_gap_analysis = None
    s.instruction_cover_letter = None
    s.kanban_hidden_columns = kanban_hidden_columns or []
    s.updated_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
    return s


# ---------------------------------------------------------------------------
# 1. Default value — kanban_hidden_columns is empty list
# ---------------------------------------------------------------------------

def test_default_kanban_hidden_columns():
    """New settings should have empty kanban_hidden_columns by default."""
    s = make_settings()
    assert s.kanban_hidden_columns == []


# ---------------------------------------------------------------------------
# 2. to_response includes kanban_hidden_columns
# ---------------------------------------------------------------------------

def test_to_response_includes_kanban_hidden_columns():
    """SettingsResponse includes kanban_hidden_columns field."""
    s = make_settings(kanban_hidden_columns=["review", "cancelled"])
    resp = to_response(s)
    assert isinstance(resp, SettingsResponse)
    assert resp.kanban_hidden_columns == ["review", "cancelled"]


def test_to_response_empty_kanban_hidden_columns():
    """SettingsResponse returns empty list when no columns hidden."""
    s = make_settings(kanban_hidden_columns=[])
    resp = to_response(s)
    assert resp.kanban_hidden_columns == []


# ---------------------------------------------------------------------------
# 3. SettingsUpdate accepts kanban_hidden_columns
# ---------------------------------------------------------------------------

def test_settings_update_schema_accepts_kanban_hidden_columns():
    """SettingsUpdate should parse kanban_hidden_columns."""
    data = SettingsUpdate(kanban_hidden_columns=["review", "cancelled"])
    assert data.kanban_hidden_columns == ["review", "cancelled"]


def test_settings_update_schema_optional_kanban_hidden_columns():
    """SettingsUpdate without kanban_hidden_columns defaults to None."""
    data = SettingsUpdate()
    assert data.kanban_hidden_columns is None


# ---------------------------------------------------------------------------
# 4. update_settings persists kanban_hidden_columns
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_update_settings_persists_kanban_hidden_columns():
    """update_settings should set kanban_hidden_columns on the model."""
    db = AsyncMock()
    db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=make_settings())))
    db.commit = AsyncMock()
    db.refresh = AsyncMock()

    user = make_user()
    data = SettingsUpdate(kanban_hidden_columns=["cancelled"])

    with patch("app.services.settings.get_or_create_settings", return_value=make_settings()):
        result = await update_settings(db, user, data)
        assert result.kanban_hidden_columns == ["cancelled"]
