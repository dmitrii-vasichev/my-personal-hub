"""Integration tests for the Telegram→CC bridge auth endpoints (Phase 2, Task 2).

Covers ``POST /api/telegram/auth/check-sender`` and
``POST /api/telegram/auth/verify-pin``. Follows the pattern of
``test_api_tokens.py``: overrides ``get_current_user`` / ``restrict_demo``
on the FastAPI app and swaps ``get_db`` for a stub (the PIN / TG-id columns
live on the already-loaded ORM instance, so no real DB is needed).
"""
from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.database import get_db
from app.core.deps import get_current_user, restrict_demo
from app.core.security import hash_password
from app.main import app
from app.models.user import User, UserRole
from app.services import pin_rate_limit


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


def _override_db():
    async def _dep():
        yield AsyncMock()

    return _dep


@pytest.fixture(autouse=True)
def _reset_rate_limit():
    """Every case starts with a clean rate-limit store; never share state."""
    pin_rate_limit._reset_for_tests()
    yield
    pin_rate_limit._reset_for_tests()


def _install_auth(user: User):
    """Override both ``restrict_demo`` and ``get_current_user`` so tests can
    exercise either chain. ``restrict_demo`` chains into ``get_current_user``
    in production, but when we override just the outer dep FastAPI will
    use the override directly and ignore the chain — which is what we want
    for positive-path tests. For the demo-rejection path we override
    ``get_current_user`` with the demo user and let ``restrict_demo`` run
    for real.
    """
    app.dependency_overrides[restrict_demo] = _override_auth(user)
    app.dependency_overrides[get_current_user] = _override_auth(user)
    app.dependency_overrides[get_db] = _override_db()


def _install_demo_auth(demo: User):
    # Only override ``get_current_user`` — ``restrict_demo`` runs for real
    # and produces the 403 we want to assert on.
    app.dependency_overrides.pop(restrict_demo, None)
    app.dependency_overrides[get_current_user] = _override_auth(demo)
    app.dependency_overrides[get_db] = _override_db()


def _teardown_auth():
    app.dependency_overrides.pop(restrict_demo, None)
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_db, None)


# ── check-sender ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_check_sender_match():
    """TG id matches ``users.telegram_user_id`` → 200 with hub_user_id."""
    user = make_user(user_id=7, telegram_user_id=111)
    _install_auth(user)
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.post(
                "/api/telegram/auth/check-sender",
                json={"telegram_user_id": 111},
            )
        assert resp.status_code == 200
        assert resp.json() == {"hub_user_id": 7}
    finally:
        _teardown_auth()


@pytest.mark.asyncio
async def test_check_sender_mismatch():
    """TG id configured but different from body → 404."""
    user = make_user(telegram_user_id=111)
    _install_auth(user)
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.post(
                "/api/telegram/auth/check-sender",
                json={"telegram_user_id": 999},
            )
        assert resp.status_code == 404
        assert resp.json()["detail"] == "Not whitelisted"
    finally:
        _teardown_auth()


@pytest.mark.asyncio
async def test_check_sender_user_not_configured():
    """Owner has not set ``telegram_user_id`` yet → 404 for any request."""
    user = make_user(telegram_user_id=None)
    _install_auth(user)
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.post(
                "/api/telegram/auth/check-sender",
                json={"telegram_user_id": 111},
            )
        assert resp.status_code == 404
    finally:
        _teardown_auth()


@pytest.mark.asyncio
async def test_check_sender_demo_rejected():
    """Demo users can never use the bridge — ``restrict_demo`` returns 403."""
    demo = make_demo()
    _install_demo_auth(demo)
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.post(
                "/api/telegram/auth/check-sender",
                json={"telegram_user_id": 111},
            )
        assert resp.status_code == 403
        assert "demo mode" in resp.json()["detail"].lower()
    finally:
        _teardown_auth()


# ── verify-pin ───────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_verify_pin_ok():
    """Correct PIN → 200 ``{ok: true}`` and rate-limit state is cleared."""
    user = make_user(telegram_pin_hash=hash_password("1234"))
    _install_auth(user)
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.post(
                "/api/telegram/auth/verify-pin",
                json={"pin": "1234"},
            )
        assert resp.status_code == 200
        assert resp.json() == {"ok": True}
    finally:
        _teardown_auth()


@pytest.mark.asyncio
async def test_verify_pin_wrong():
    """Wrong PIN → 401 and the failure is recorded in the rate limiter."""
    user = make_user(user_id=42, telegram_pin_hash=hash_password("1234"))
    _install_auth(user)
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.post(
                "/api/telegram/auth/verify-pin",
                json={"pin": "9999"},
            )
        assert resp.status_code == 401
        assert resp.json()["detail"] == "Wrong PIN"
        # Side effect: one failure is now on the user's tally.
        assert 42 in pin_rate_limit._failures
        assert len(pin_rate_limit._failures[42]) == 1
    finally:
        _teardown_auth()


@pytest.mark.asyncio
async def test_verify_pin_lockout():
    """5 consecutive wrong PINs → sixth call returns 429 with seconds left."""
    user = make_user(user_id=77, telegram_pin_hash=hash_password("1234"))
    _install_auth(user)
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            for _ in range(pin_rate_limit.MAX_ATTEMPTS):
                bad = await client.post(
                    "/api/telegram/auth/verify-pin",
                    json={"pin": "0000"},
                )
                assert bad.status_code == 401
            locked = await client.post(
                "/api/telegram/auth/verify-pin",
                json={"pin": "1234"},
            )
        assert locked.status_code == 429
        assert "locked out" in locked.json()["detail"].lower()
        assert "retry in" in locked.json()["detail"].lower()
    finally:
        _teardown_auth()


@pytest.mark.asyncio
async def test_verify_pin_not_configured():
    """``telegram_pin_hash IS NULL`` → 400 "PIN not configured"."""
    user = make_user(telegram_pin_hash=None)
    _install_auth(user)
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.post(
                "/api/telegram/auth/verify-pin",
                json={"pin": "1234"},
            )
        assert resp.status_code == 400
        assert resp.json()["detail"] == "PIN not configured"
    finally:
        _teardown_auth()


@pytest.mark.asyncio
async def test_verify_pin_validation_non_digit():
    """Non-digit PIN → 422 from pydantic at the schema layer."""
    user = make_user(telegram_pin_hash=hash_password("1234"))
    _install_auth(user)
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.post(
                "/api/telegram/auth/verify-pin",
                json={"pin": "abcd"},
            )
        assert resp.status_code == 422
    finally:
        _teardown_auth()


@pytest.mark.asyncio
async def test_verify_pin_validation_too_short():
    """PIN shorter than 4 digits → 422."""
    user = make_user(telegram_pin_hash=hash_password("1234"))
    _install_auth(user)
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.post(
                "/api/telegram/auth/verify-pin",
                json={"pin": "12"},
            )
        assert resp.status_code == 422
    finally:
        _teardown_auth()
