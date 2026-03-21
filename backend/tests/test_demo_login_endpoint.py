"""Tests for POST /api/auth/demo-login endpoint."""
from __future__ import annotations

import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

from httpx import ASGITransport, AsyncClient

from app.main import app
from app.models.user import User, UserRole


def _make_demo_user() -> User:
    u = User()
    u.id = 99
    u.role = UserRole.demo
    u.email = "demo@personalhub.app"
    u.display_name = "Alex Demo"
    u.is_blocked = False
    u.must_change_password = False
    u.theme = "dark"
    u.created_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
    u.last_login_at = None
    return u


def _mock_db(query_result):
    """Create a mock db session with execute returning query_result."""
    result_obj = MagicMock()
    result_obj.scalar_one_or_none.return_value = query_result

    db = AsyncMock()
    db.execute.return_value = result_obj
    return db


@pytest.mark.asyncio
async def test_demo_login_returns_token():
    """POST /api/auth/demo-login returns access_token when demo user exists."""
    demo_user = _make_demo_user()
    mock_db = _mock_db(demo_user)

    async def _override_db():
        yield mock_db

    from app.core.database import get_db
    app.dependency_overrides[get_db] = _override_db

    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.post("/api/auth/demo-login")
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["must_change_password"] is False
    finally:
        app.dependency_overrides.pop(get_db, None)


@pytest.mark.asyncio
async def test_demo_login_404_when_no_demo_user():
    """POST /api/auth/demo-login returns 404 when demo user doesn't exist."""
    mock_db = _mock_db(None)

    async def _override_db():
        yield mock_db

    from app.core.database import get_db
    app.dependency_overrides[get_db] = _override_db

    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.post("/api/auth/demo-login")
        assert resp.status_code == 404
        assert "Demo user not found" in resp.json()["detail"]
    finally:
        app.dependency_overrides.pop(get_db, None)


@pytest.mark.asyncio
async def test_demo_login_no_credentials_required():
    """POST /api/auth/demo-login requires no request body."""
    demo_user = _make_demo_user()
    mock_db = _mock_db(demo_user)

    async def _override_db():
        yield mock_db

    from app.core.database import get_db
    app.dependency_overrides[get_db] = _override_db

    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.post("/api/auth/demo-login")
        assert resp.status_code == 200
    finally:
        app.dependency_overrides.pop(get_db, None)
