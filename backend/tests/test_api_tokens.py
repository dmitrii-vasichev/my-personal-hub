"""Integration tests for API token management (Phase 2, Task A7).

Exercises the three ``/api/auth/tokens`` endpoints plus the hybrid
``get_current_user`` dependency (JWT + API-token bearer).

Follows the project convention of ``test_planner_api.py``: overrides
``get_current_user`` / ``get_db`` on the FastAPI app and monkeypatches the
service layer (``app.services.api_token``). The service itself is unit-tested
separately — here we only verify the HTTP edges: status codes, response
shapes, demo-user gating, and that the existing JWT flow still resolves a
user after the dependency change.
"""
from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.security import create_access_token
from app.main import app
from app.models.api_token import ApiToken
from app.models.user import User, UserRole
from app.services import api_token as api_token_service


# ── Helpers ──────────────────────────────────────────────────────────────────


def make_user(
    user_id: int = 1, role: UserRole = UserRole.member
) -> User:
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


def _override_auth(user: User):
    async def _dep():
        return user

    return _dep


def _override_db():
    # Services are monkeypatched in each test; the DB session is never
    # actually queried. Return a bare AsyncMock so dependency resolution
    # succeeds.
    async def _dep():
        yield AsyncMock()

    return _dep


def _make_api_token(
    *,
    id_: int = 1,
    user_id: int = 1,
    name: str = "ci-script",
    prefix: str = "phub_abc123",
    last_used_at: datetime | None = None,
) -> ApiToken:
    t = ApiToken()
    t.id = id_
    t.user_id = user_id
    t.name = name
    t.token_hash = "hashed"
    t.token_prefix = prefix
    t.last_used_at = last_used_at
    t.revoked_at = None
    t.created_at = datetime(2026, 4, 17, 8, 0, tzinfo=timezone.utc)
    return t


# ── Happy path: create → use as bearer → list → revoke → 401 ─────────────────


@pytest.mark.asyncio
async def test_create_token_returns_201_with_raw_token(monkeypatch):
    """POST /api/auth/tokens → 201, body includes raw token once."""
    user = make_user()
    token_row = _make_api_token(id_=10, user_id=user.id, name="ci")
    raw = "phub_abcdefghijKLMNOPqrstuv"

    async def fake_create(db, u, name):
        assert u.id == user.id
        assert name == "ci"
        return token_row, raw

    monkeypatch.setattr(api_token_service, "create_token", fake_create)

    app.dependency_overrides[get_current_user] = _override_auth(user)
    app.dependency_overrides[get_db] = _override_db()
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.post(
                "/api/auth/tokens", json={"name": "ci"}
            )
        assert resp.status_code == 201
        data = resp.json()
        assert data["id"] == 10
        assert data["name"] == "ci"
        assert data["raw_token"] == raw
        assert data["token_prefix"] == token_row.token_prefix
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_db, None)


@pytest.mark.asyncio
async def test_list_tokens_returns_only_active(monkeypatch):
    """GET /api/auth/tokens → 200 with active tokens; response hides hash."""
    user = make_user()
    active = _make_api_token(id_=1, user_id=user.id, name="ci")

    async def fake_list(db, u):
        assert u.id == user.id
        return [active]

    monkeypatch.setattr(api_token_service, "list_tokens", fake_list)

    app.dependency_overrides[get_current_user] = _override_auth(user)
    app.dependency_overrides[get_db] = _override_db()
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.get("/api/auth/tokens")
        assert resp.status_code == 200
        body = resp.json()
        assert len(body) == 1
        assert body[0]["id"] == 1
        assert body[0]["name"] == "ci"
        # List response must NOT leak the raw token or the hash.
        assert "raw_token" not in body[0]
        assert "token_hash" not in body[0]
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_db, None)


@pytest.mark.asyncio
async def test_revoke_token_returns_204(monkeypatch):
    """DELETE /api/auth/tokens/{id} → 204 No Content on success."""
    user = make_user()

    async def fake_revoke(db, u, token_id):
        assert u.id == user.id
        assert token_id == 42
        return True

    monkeypatch.setattr(api_token_service, "revoke_token", fake_revoke)

    app.dependency_overrides[get_current_user] = _override_auth(user)
    app.dependency_overrides[get_db] = _override_db()
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.delete("/api/auth/tokens/42")
        assert resp.status_code == 204
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_db, None)


@pytest.mark.asyncio
async def test_revoke_unknown_token_returns_404(monkeypatch):
    """DELETE on a token the user doesn't own / already revoked → 404."""
    user = make_user()

    async def fake_revoke(db, u, token_id):
        return False

    monkeypatch.setattr(api_token_service, "revoke_token", fake_revoke)

    app.dependency_overrides[get_current_user] = _override_auth(user)
    app.dependency_overrides[get_db] = _override_db()
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.delete("/api/auth/tokens/99999")
        assert resp.status_code == 404
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_db, None)


@pytest.mark.asyncio
async def test_raw_token_authenticates_protected_endpoint():
    """Using a raw API token as ``Authorization: Bearer …`` resolves the user.

    Hits ``/api/auth/me`` without overriding ``get_current_user`` so the real
    dependency runs: JWT decode fails → fallback to ``resolve_token`` →
    user returned. Updates ``last_used_at`` on success.
    """
    user = make_user()
    raw = "phub_someRawTokenValueXyz"

    async def fake_resolve(db, token):
        assert token == raw
        return user

    # Stub the DB session the dep needs — our fake_resolve ignores it.
    async def _stub_db():
        yield AsyncMock()

    from app.core.database import get_db as _get_db
    app.dependency_overrides[_get_db] = _stub_db
    try:
        with patch(
            "app.core.deps.resolve_token", side_effect=fake_resolve
        ):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.get(
                    "/api/auth/me",
                    headers={"Authorization": f"Bearer {raw}"},
                )
        assert resp.status_code == 200
        assert resp.json()["email"] == user.email
    finally:
        app.dependency_overrides.pop(_get_db, None)


@pytest.mark.asyncio
async def test_revoked_token_returns_401():
    """A raw token whose service returns None (revoked/unknown) → 401."""
    raw = "phub_revokedTokenZzz"

    async def fake_resolve(db, token):
        return None  # simulates revoked or never-existed

    async def _stub_db():
        yield AsyncMock()

    from app.core.database import get_db as _get_db
    app.dependency_overrides[_get_db] = _stub_db
    try:
        with patch(
            "app.core.deps.resolve_token", side_effect=fake_resolve
        ):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.get(
                    "/api/auth/me",
                    headers={"Authorization": f"Bearer {raw}"},
                )
        assert resp.status_code == 401
        assert "invalid" in resp.json()["detail"].lower()
    finally:
        app.dependency_overrides.pop(_get_db, None)


# ── Duplicate name (409) ─────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_token_duplicate_name_returns_409(monkeypatch):
    """Service raises ``ValueError('duplicate')`` → router returns 409."""
    user = make_user()

    async def fake_create(db, u, name):
        raise ValueError("duplicate")

    monkeypatch.setattr(api_token_service, "create_token", fake_create)

    app.dependency_overrides[get_current_user] = _override_auth(user)
    app.dependency_overrides[get_db] = _override_db()
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.post(
                "/api/auth/tokens", json={"name": "ci"}
            )
        assert resp.status_code == 409
        assert "already" in resp.json()["detail"].lower()
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_db, None)


# ── Demo-user gating via restrict_demo ──────────────────────────────────────


@pytest.mark.asyncio
async def test_demo_user_cannot_create_token():
    """POST /api/auth/tokens → 403 for demo users."""
    demo = make_demo_user()
    app.dependency_overrides[get_current_user] = _override_auth(demo)
    app.dependency_overrides[get_db] = _override_db()
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.post(
                "/api/auth/tokens", json={"name": "ci"}
            )
        assert resp.status_code == 403
        assert "demo mode" in resp.json()["detail"].lower()
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_db, None)


@pytest.mark.asyncio
async def test_demo_user_cannot_revoke_token():
    """DELETE /api/auth/tokens/{id} → 403 for demo users."""
    demo = make_demo_user()
    app.dependency_overrides[get_current_user] = _override_auth(demo)
    app.dependency_overrides[get_db] = _override_db()
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.delete("/api/auth/tokens/1")
        assert resp.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_db, None)


@pytest.mark.asyncio
async def test_demo_user_can_list_tokens(monkeypatch):
    """GET /api/auth/tokens → 200 for demo users (read-only is allowed)."""
    demo = make_demo_user()

    async def fake_list(db, u):
        assert u.id == demo.id
        return []

    monkeypatch.setattr(api_token_service, "list_tokens", fake_list)

    app.dependency_overrides[get_current_user] = _override_auth(demo)
    app.dependency_overrides[get_db] = _override_db()
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.get("/api/auth/tokens")
        assert resp.status_code == 200
        assert resp.json() == []
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_db, None)


# ── JWT flow still works after deps.py was extended with resolve_token ──────


@pytest.mark.asyncio
async def test_jwt_bearer_still_resolves_user():
    """Existing JWT path: ``get_current_user`` decodes the JWT and loads
    the user by id — ``resolve_token`` is never called.
    """
    user = make_user()
    jwt = create_access_token(user.id, user.role.value)

    async def _stub_db():
        yield AsyncMock()

    from app.core.database import get_db as _get_db
    app.dependency_overrides[_get_db] = _stub_db
    try:
        with patch(
            "app.core.deps.get_user_by_id", return_value=user
        ) as mock_jwt_lookup, patch(
            "app.core.deps.resolve_token", new_callable=AsyncMock
        ) as mock_api_lookup:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.get(
                    "/api/auth/me",
                    headers={"Authorization": f"Bearer {jwt}"},
                )
        assert resp.status_code == 200
        assert resp.json()["email"] == user.email
        # JWT path taken:
        mock_jwt_lookup.assert_awaited_once()
        # API-token fallback NOT taken:
        mock_api_lookup.assert_not_called()
    finally:
        app.dependency_overrides.pop(_get_db, None)
