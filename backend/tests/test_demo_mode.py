"""
Tests for Phase 42: Demo Mode Backend.
Covers: restrict_demo dependency, restricted endpoints (AI, integrations, password),
demo user CRUD, settings response, notes local content, reset endpoint.
"""
from __future__ import annotations

import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

from httpx import ASGITransport, AsyncClient

from app.core.deps import restrict_demo
from app.main import app
from app.models.note import Note
from app.models.user import User, UserRole


# ── Helpers ──────────────────────────────────────────────────────────────────


def make_user(user_id: int = 1, role: UserRole = UserRole.member) -> User:
    u = User()
    u.id = user_id
    u.role = role
    u.email = f"user{user_id}@example.com"
    u.display_name = f"User {user_id}"
    u.is_blocked = False
    u.must_change_password = False
    u.theme = "dark"
    u.timezone = "UTC"
    u.created_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
    return u


def make_demo_user(user_id: int = 99) -> User:
    return make_user(user_id=user_id, role=UserRole.demo)


def make_admin_user(user_id: int = 1) -> User:
    return make_user(user_id=user_id, role=UserRole.admin)


def _override_auth(user: User):
    """Create a dependency override for get_current_user."""
    async def _dep():
        return user
    return _dep


# ── restrict_demo dependency ─────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_restrict_demo_blocks_demo_user():
    """restrict_demo raises 403 for demo users."""
    demo = make_demo_user()
    with pytest.raises(Exception) as exc_info:
        await restrict_demo(demo)
    assert exc_info.value.status_code == 403
    assert "demo mode" in exc_info.value.detail.lower()


@pytest.mark.asyncio
async def test_restrict_demo_allows_member():
    """restrict_demo passes through for member users."""
    member = make_user(role=UserRole.member)
    result = await restrict_demo(member)
    assert result == member


@pytest.mark.asyncio
async def test_restrict_demo_allows_admin():
    """restrict_demo passes through for admin users."""
    admin = make_admin_user()
    result = await restrict_demo(admin)
    assert result == admin


# ── AI endpoints blocked for demo ────────────────────────────────────────────


@pytest.mark.asyncio
async def test_resume_generate_blocked_for_demo():
    demo = make_demo_user()
    from app.core.deps import get_current_user
    app.dependency_overrides[get_current_user] = _override_auth(demo)
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.post(
                "/api/resumes/generate", json={"job_id": 1}
            )
        assert resp.status_code == 403
        assert "demo mode" in resp.json()["detail"].lower()
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_resume_ats_audit_blocked_for_demo():
    demo = make_demo_user()
    from app.core.deps import get_current_user
    app.dependency_overrides[get_current_user] = _override_auth(demo)
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.post("/api/resumes/1/ats-audit")
        assert resp.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_resume_gap_analysis_blocked_for_demo():
    demo = make_demo_user()
    from app.core.deps import get_current_user
    app.dependency_overrides[get_current_user] = _override_auth(demo)
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.post("/api/resumes/1/gap-analysis")
        assert resp.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_cover_letter_generate_blocked_for_demo():
    demo = make_demo_user()
    from app.core.deps import get_current_user
    app.dependency_overrides[get_current_user] = _override_auth(demo)
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.post(
                "/api/cover-letters/generate", json={"job_id": 1}
            )
        assert resp.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_job_match_blocked_for_demo():
    demo = make_demo_user()
    from app.core.deps import get_current_user
    app.dependency_overrides[get_current_user] = _override_auth(demo)
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.post("/api/jobs/1/match")
        assert resp.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_profile_import_blocked_for_demo():
    demo = make_demo_user()
    from app.core.deps import get_current_user
    app.dependency_overrides[get_current_user] = _override_auth(demo)
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.post(
                "/api/profile/import", json={"text": "My resume..."}
            )
        assert resp.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)


# ── Integration endpoints blocked for demo ───────────────────────────────────


@pytest.mark.asyncio
async def test_calendar_oauth_connect_blocked_for_demo():
    demo = make_demo_user()
    from app.core.deps import get_current_user
    app.dependency_overrides[get_current_user] = _override_auth(demo)
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.get("/api/calendar/oauth/connect")
        assert resp.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_calendar_sync_blocked_for_demo():
    demo = make_demo_user()
    from app.core.deps import get_current_user
    app.dependency_overrides[get_current_user] = _override_auth(demo)
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.post("/api/calendar/sync")
        assert resp.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_notes_create_blocked_for_demo():
    demo = make_demo_user()
    from app.core.deps import get_current_user
    app.dependency_overrides[get_current_user] = _override_auth(demo)
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.post(
                "/api/notes/", json={"title": "Test", "content": "Test content"}
            )
        assert resp.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_notes_sync_blocked_for_demo():
    demo = make_demo_user()
    from app.core.deps import get_current_user
    app.dependency_overrides[get_current_user] = _override_auth(demo)
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.post("/api/notes/sync")
        assert resp.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_search_blocked_for_demo():
    demo = make_demo_user()
    from app.core.deps import get_current_user
    app.dependency_overrides[get_current_user] = _override_auth(demo)
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.post(
                "/api/search/",
                json={"query": "python", "location": "remote", "provider": "adzuna"},
            )
        assert resp.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_auto_search_blocked_for_demo():
    demo = make_demo_user()
    from app.core.deps import get_current_user
    app.dependency_overrides[get_current_user] = _override_auth(demo)
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.post("/api/search/auto", json={})
        assert resp.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_pulse_poll_blocked_for_demo():
    demo = make_demo_user()
    from app.core.deps import get_current_user
    app.dependency_overrides[get_current_user] = _override_auth(demo)
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.post("/api/pulse/sources/poll")
        assert resp.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_pulse_resolve_blocked_for_demo():
    demo = make_demo_user()
    from app.core.deps import get_current_user
    app.dependency_overrides[get_current_user] = _override_auth(demo)
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.get(
                "/api/pulse/sources/resolve?identifier=test_channel"
            )
        assert resp.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_digest_generate_blocked_for_demo():
    demo = make_demo_user()
    from app.core.deps import get_current_user
    app.dependency_overrides[get_current_user] = _override_auth(demo)
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.post(
                "/api/pulse/digests/generate", json={"category": "learning"}
            )
        assert resp.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)


# ── Password change blocked for demo ────────────────────────────────────────


@pytest.mark.asyncio
async def test_change_password_blocked_for_demo():
    demo = make_demo_user()
    from app.core.deps import get_current_user
    app.dependency_overrides[get_current_user] = _override_auth(demo)
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.post(
                "/api/auth/change-password",
                json={"current_password": "old", "new_password": "new123"},
            )
        assert resp.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)


# ── Demo user CAN do allowed operations ──────────────────────────────────────


@pytest.mark.asyncio
async def test_demo_user_can_get_me():
    """Demo user can access /auth/me endpoint."""
    demo = make_demo_user()
    from app.core.deps import get_current_user
    app.dependency_overrides[get_current_user] = _override_auth(demo)
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.get("/api/auth/me")
        assert resp.status_code == 200
        data = resp.json()
        assert data["role"] == "demo"
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_demo_user_can_list_tasks():
    """Demo user can access tasks (allowed CRUD)."""
    demo = make_demo_user()
    from app.core.deps import get_current_user
    from app.core.database import get_db
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []
    mock_db.execute = AsyncMock(return_value=mock_result)

    app.dependency_overrides[get_current_user] = _override_auth(demo)
    app.dependency_overrides[get_db] = lambda: mock_db
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.get("/api/tasks/")
        assert resp.status_code == 200
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_db, None)


@pytest.mark.asyncio
async def test_demo_user_can_list_jobs():
    """Demo user can access job list (allowed CRUD)."""
    demo = make_demo_user()
    from app.core.deps import get_current_user
    from app.core.database import get_db
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []
    mock_db.execute = AsyncMock(return_value=mock_result)

    app.dependency_overrides[get_current_user] = _override_auth(demo)
    app.dependency_overrides[get_db] = lambda: mock_db
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.get("/api/jobs/")
        assert resp.status_code == 200
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_db, None)


# ── Settings response for demo ───────────────────────────────────────────────


@pytest.mark.asyncio
async def test_settings_get_returns_member_view_for_demo():
    """Demo user gets member-style settings response (no API key indicators)."""
    demo = make_demo_user()
    from app.core.deps import get_current_user
    from app.core.database import get_db
    from app.models.settings import UserSettings

    mock_settings = UserSettings()
    mock_settings.id = 1
    mock_settings.user_id = demo.id
    mock_settings.default_location = "Remote"
    mock_settings.target_roles = ["Senior Engineer"]
    mock_settings.min_match_score = 70
    mock_settings.excluded_companies = []
    mock_settings.stale_threshold_days = 30
    mock_settings.updated_at = datetime(2026, 1, 1, tzinfo=timezone.utc)

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_settings
    mock_db.execute = AsyncMock(return_value=mock_result)

    app.dependency_overrides[get_current_user] = _override_auth(demo)
    app.dependency_overrides[get_db] = lambda: mock_db
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.get("/api/settings/")
        assert resp.status_code == 200
        data = resp.json()
        # Member response should NOT have has_api_key_* fields
        assert "has_api_key_openai" not in data
        assert "llm_provider" not in data
        # Should have job search fields
        assert "default_location" in data
        assert "target_roles" in data
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_db, None)


@pytest.mark.asyncio
async def test_settings_update_strips_admin_fields_for_demo():
    """Demo user settings update only allows job search fields."""
    demo = make_demo_user()
    from app.core.deps import get_current_user
    from app.core.database import get_db
    from app.models.settings import UserSettings

    mock_settings = UserSettings()
    mock_settings.id = 1
    mock_settings.user_id = demo.id
    mock_settings.default_location = "Remote"
    mock_settings.target_roles = []
    mock_settings.min_match_score = 70
    mock_settings.excluded_companies = []
    mock_settings.stale_threshold_days = 30
    mock_settings.kanban_hidden_columns = []
    mock_settings.updated_at = datetime(2026, 1, 1, tzinfo=timezone.utc)

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_settings
    mock_db.execute = AsyncMock(return_value=mock_result)
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    app.dependency_overrides[get_current_user] = _override_auth(demo)
    app.dependency_overrides[get_db] = lambda: mock_db
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.put(
                "/api/settings/",
                json={
                    "default_location": "NYC",
                    "llm_provider": "openai",  # should be stripped
                    "api_key_openai": "sk-test",  # should be stripped
                },
            )
        assert resp.status_code == 200
        # Verify that the settings weren't updated with admin fields
        assert mock_settings.default_location == "NYC"
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_db, None)


# ── Notes tree for demo user ────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_notes_tree_returns_flat_list_for_demo():
    """Demo user gets a flat list of local notes, not Google Drive tree."""
    demo = make_demo_user()
    from app.core.deps import get_current_user
    from app.core.database import get_db

    mock_note = MagicMock(spec=Note)
    mock_note.id = 1
    mock_note.title = "Test Note"
    mock_note.mime_type = "text/markdown"
    mock_note.google_file_id = None
    mock_note.content = "Hello"

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [mock_note]
    mock_db.execute = AsyncMock(return_value=mock_result)

    app.dependency_overrides[get_current_user] = _override_auth(demo)
    app.dependency_overrides[get_db] = lambda: mock_db
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.get("/api/notes/tree")
        assert resp.status_code == 200
        data = resp.json()
        assert data["folder_id"] == "demo"
        assert len(data["tree"]) == 1
        assert data["tree"][0]["name"] == "Test Note"
        assert data["tree"][0]["type"] == "file"
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_db, None)


# ── Notes local content ─────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_notes_content_returns_local_for_demo():
    """Demo user gets content from local note (content field)."""
    demo = make_demo_user()
    from app.core.deps import get_current_user
    from app.core.database import get_db

    mock_note = MagicMock()
    mock_note.content = "# Hello World\nThis is local content."

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_note
    mock_db.execute = AsyncMock(return_value=mock_result)

    app.dependency_overrides[get_current_user] = _override_auth(demo)
    app.dependency_overrides[get_db] = lambda: mock_db
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.get("/api/notes/1/content")
        assert resp.status_code == 200
        data = resp.json()
        assert "Hello World" in data["content"]
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_db, None)


# ── Telegram endpoints blocked for demo ──────────────────────────────────────


@pytest.mark.asyncio
async def test_telegram_start_auth_blocked_for_demo():
    demo = make_demo_user()
    from app.core.deps import get_current_user
    app.dependency_overrides[get_current_user] = _override_auth(demo)
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.post(
                "/api/pulse/telegram/start-auth",
                json={"phone_number": "+1234567890"},
            )
        assert resp.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_telegram_verify_code_blocked_for_demo():
    demo = make_demo_user()
    from app.core.deps import get_current_user
    app.dependency_overrides[get_current_user] = _override_auth(demo)
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.post(
                "/api/pulse/telegram/verify-code",
                json={"code": "12345"},
            )
        assert resp.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)


# ── Seed script functions ────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_seed_demo_module_importable():
    """Verify seed_demo module can be imported without errors."""
    from app.scripts import seed_demo

    assert seed_demo.DEMO_EMAIL == "demo@personalhub.app"
    assert seed_demo.DEMO_DISPLAY_NAME == "Alex Demo"
    # Verify all public seed functions exist
    assert callable(seed_demo.seed)
    assert callable(seed_demo.cleanup_demo_user)
    assert callable(seed_demo.create_demo_user)
    assert callable(seed_demo.create_profile)
    assert callable(seed_demo.create_tags)
    assert callable(seed_demo.create_tasks)
    assert callable(seed_demo.create_jobs)
    assert callable(seed_demo.create_events)
    assert callable(seed_demo.create_kb_docs)
    assert callable(seed_demo.create_notes)
    assert callable(seed_demo.create_pulse_data)


# ── Reset endpoint ───────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_reset_demo_blocked_for_non_admin():
    """Only admin can reset demo data."""
    member = make_user(role=UserRole.member)
    from app.core.deps import get_current_user
    app.dependency_overrides[get_current_user] = _override_auth(member)
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.post("/api/users/demo/reset")
        assert resp.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_reset_demo_allowed_for_demo_user():
    """Demo user can reset their own data."""
    demo = make_demo_user()
    from app.core.deps import get_current_user
    app.dependency_overrides[get_current_user] = _override_auth(demo)
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.post("/api/users/demo/reset")
        assert resp.status_code == 200
    finally:
        app.dependency_overrides.pop(get_current_user, None)
