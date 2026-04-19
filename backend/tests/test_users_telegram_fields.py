"""Integration tests for the owner-self-service PUT endpoints (Phase 2, Task 2).

Covers ``PUT /api/users/me/telegram-pin`` and
``PUT /api/users/me/telegram-user-id`` plus the ``UserResponse`` extension
(two new fields: ``telegram_user_id`` and ``telegram_pin_configured``).
"""
from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.database import get_db
from app.core.deps import get_current_user, restrict_demo
from app.core.security import verify_password
from app.main import app
from app.models.user import User, UserRole


# ── Helpers ──────────────────────────────────────────────────────────────────


def make_user(
    *,
    user_id: int = 1,
    role: UserRole = UserRole.member,
    telegram_user_id: int | None = None,
    telegram_pin_hash: str | None = None,
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
    u.last_login_at = None
    u.created_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
    u.telegram_user_id = telegram_user_id
    u.telegram_pin_hash = telegram_pin_hash
    return u


def make_demo(user_id: int = 99) -> User:
    return make_user(user_id=user_id, role=UserRole.demo)


def _override_auth(user: User):
    async def _dep():
        return user

    return _dep


def _override_db_with_commit(commit_mock: AsyncMock):
    async def _dep():
        session = AsyncMock()
        session.commit = commit_mock
        session.rollback = AsyncMock()
        yield session

    return _dep


def _install_auth(user: User, commit_mock: AsyncMock | None = None):
    """Override ``restrict_demo`` directly (positive paths) + stub DB."""
    app.dependency_overrides[restrict_demo] = _override_auth(user)
    app.dependency_overrides[get_current_user] = _override_auth(user)
    app.dependency_overrides[get_db] = _override_db_with_commit(
        commit_mock or AsyncMock()
    )


def _install_demo_auth(demo: User):
    # Don't override ``restrict_demo`` — let it run and return 403.
    app.dependency_overrides.pop(restrict_demo, None)
    app.dependency_overrides[get_current_user] = _override_auth(demo)
    app.dependency_overrides[get_db] = _override_db_with_commit(AsyncMock())


def _teardown_auth():
    app.dependency_overrides.pop(restrict_demo, None)
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_db, None)


# ── PUT /me/telegram-pin ─────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_put_telegram_pin_hashes():
    """Setting a PIN bcrypt-hashes it into the user's row."""
    user = make_user(telegram_pin_hash=None)
    commit_mock = AsyncMock()
    _install_auth(user, commit_mock=commit_mock)
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.put(
                "/api/users/me/telegram-pin", json={"pin": "1234"}
            )
        assert resp.status_code == 204
        # Value was written on the in-memory user object and is bcrypt-verifiable.
        assert user.telegram_pin_hash is not None
        assert verify_password("1234", user.telegram_pin_hash)
        commit_mock.assert_awaited()
    finally:
        _teardown_auth()


@pytest.mark.asyncio
async def test_put_telegram_pin_rotate():
    """Rotating the PIN invalidates the previous one."""
    user = make_user(telegram_pin_hash=None)
    _install_auth(user)
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            await client.put(
                "/api/users/me/telegram-pin", json={"pin": "1234"}
            )
            first_hash = user.telegram_pin_hash
            assert verify_password("1234", first_hash)

            resp = await client.put(
                "/api/users/me/telegram-pin", json={"pin": "9876"}
            )
        assert resp.status_code == 204
        assert user.telegram_pin_hash != first_hash
        assert verify_password("9876", user.telegram_pin_hash)
        assert not verify_password("1234", user.telegram_pin_hash)
    finally:
        _teardown_auth()


@pytest.mark.asyncio
async def test_put_telegram_pin_validation():
    """PIN must match ``^\\d{4,8}$`` — everything else → 422."""
    user = make_user()
    _install_auth(user)
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            for bad in ("abc", "12", "123456789"):
                resp = await client.put(
                    "/api/users/me/telegram-pin", json={"pin": bad}
                )
                assert resp.status_code == 422, f"pin={bad!r}"
    finally:
        _teardown_auth()


# ── PUT /me/telegram-user-id ─────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_put_telegram_user_id_happy():
    """Setting TG user id writes to the user row and commits."""
    user = make_user(telegram_user_id=None)
    commit_mock = AsyncMock()
    _install_auth(user, commit_mock=commit_mock)
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.put(
                "/api/users/me/telegram-user-id",
                json={"telegram_user_id": 555},
            )
        assert resp.status_code == 204
        assert user.telegram_user_id == 555
        commit_mock.assert_awaited()
    finally:
        _teardown_auth()


@pytest.mark.asyncio
async def test_put_telegram_user_id_validation_zero():
    """``telegram_user_id=0`` fails ``gt=0`` → 422."""
    user = make_user()
    _install_auth(user)
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.put(
                "/api/users/me/telegram-user-id",
                json={"telegram_user_id": 0},
            )
        assert resp.status_code == 422
    finally:
        _teardown_auth()


@pytest.mark.asyncio
async def test_put_telegram_user_id_validation_negative():
    """Negative ids fail ``gt=0`` → 422."""
    user = make_user()
    _install_auth(user)
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.put(
                "/api/users/me/telegram-user-id",
                json={"telegram_user_id": -5},
            )
        assert resp.status_code == 422
    finally:
        _teardown_auth()


# ── Demo-user gating via restrict_demo ──────────────────────────────────────


@pytest.mark.asyncio
async def test_demo_rejected_on_telegram_pin():
    """Demo accounts cannot set a PIN — ``restrict_demo`` returns 403."""
    demo = make_demo()
    _install_demo_auth(demo)
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.put(
                "/api/users/me/telegram-pin", json={"pin": "1234"}
            )
        assert resp.status_code == 403
    finally:
        _teardown_auth()


@pytest.mark.asyncio
async def test_demo_rejected_on_telegram_user_id():
    """Demo accounts cannot set a TG user id — ``restrict_demo`` returns 403."""
    demo = make_demo()
    _install_demo_auth(demo)
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.put(
                "/api/users/me/telegram-user-id",
                json={"telegram_user_id": 123},
            )
        assert resp.status_code == 403
    finally:
        _teardown_auth()


# ── UserResponse projection: telegram fields present and correct ────────────


@pytest.mark.asyncio
async def test_me_response_includes_telegram_fields_set():
    """``GET /api/auth/me`` for a user with both TG fields set returns them."""
    user = make_user(
        telegram_user_id=12345,
        telegram_pin_hash="$2b$12$fakehashvalueabcdefghijklmnopqrstuvwxyz01234",
    )
    app.dependency_overrides[get_current_user] = _override_auth(user)
    app.dependency_overrides[get_db] = _override_db_with_commit(AsyncMock())
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.get("/api/auth/me")
        assert resp.status_code == 200
        body = resp.json()
        assert body["telegram_user_id"] == 12345
        assert body["telegram_pin_configured"] is True
        # Bcrypt hash must never leak:
        assert "telegram_pin_hash" not in body
    finally:
        _teardown_auth()


@pytest.mark.asyncio
async def test_me_response_includes_telegram_fields_unset():
    """``GET /api/auth/me`` for a user with neither field set reports empties."""
    user = make_user(telegram_user_id=None, telegram_pin_hash=None)
    app.dependency_overrides[get_current_user] = _override_auth(user)
    app.dependency_overrides[get_db] = _override_db_with_commit(AsyncMock())
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.get("/api/auth/me")
        assert resp.status_code == 200
        body = resp.json()
        assert body["telegram_user_id"] is None
        assert body["telegram_pin_configured"] is False
        assert "telegram_pin_hash" not in body
    finally:
        _teardown_auth()
