"""Tests for the Phase-1 consolidated ``User.timezone`` field.

Phase 1, Task 1 adds ``timezone`` to ``users`` as the single source of truth
(replacing ``pulse_settings.timezone``). The profile PUT endpoint exposes it
to the user with IANA validation; the response schema returns it.
"""
from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.security import create_access_token
from app.main import app
from app.models.user import User, UserRole
from app.schemas.auth import (
    CreateUserRequest,
    UpdateProfileRequest,
    UpdateUserRequest,
)


def _make_user(user_id: int = 1, tz: str = "UTC") -> User:
    u = User()
    u.id = user_id
    u.email = f"user{user_id}@example.com"
    u.display_name = f"User {user_id}"
    u.password_hash = "hashed"
    u.role = UserRole.member
    u.must_change_password = False
    u.is_blocked = False
    u.theme = "dark"
    u.timezone = tz
    u.last_login_at = None
    u.created_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
    return u


# ---------------------------------------------------------------------------
# Schema-level IANA validation
# ---------------------------------------------------------------------------


def test_update_profile_rejects_invalid_timezone():
    with pytest.raises(Exception):
        UpdateProfileRequest(timezone="Foo/Bar")


def test_update_profile_accepts_iana_timezone():
    req = UpdateProfileRequest(timezone="Europe/Berlin")
    assert req.timezone == "Europe/Berlin"


def test_update_profile_allows_none_timezone():
    req = UpdateProfileRequest(display_name="X")
    assert req.timezone is None


def test_create_user_request_defaults_to_utc():
    req = CreateUserRequest(email="a@b.com", display_name="A")
    assert req.timezone == "UTC"


def test_create_user_request_rejects_invalid_timezone():
    with pytest.raises(Exception):
        CreateUserRequest(email="a@b.com", display_name="A", timezone="Not/Real")


def test_update_user_request_rejects_invalid_timezone():
    with pytest.raises(Exception):
        UpdateUserRequest(timezone="Not/Real")


def test_update_user_request_accepts_iana_timezone():
    req = UpdateUserRequest(timezone="America/New_York")
    assert req.timezone == "America/New_York"


# ---------------------------------------------------------------------------
# Profile API — GET/PUT /api/auth/profile returns and updates timezone
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_profile_returns_timezone():
    """GET /api/auth/profile exposes the user's timezone."""
    user = _make_user(tz="America/Denver")

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
    assert response.json()["timezone"] == "America/Denver"


@pytest.mark.asyncio
async def test_put_profile_rejects_invalid_timezone():
    """PUT /api/auth/profile with a bogus IANA name is rejected by pydantic."""
    user = _make_user()

    with patch("app.core.deps.get_user_by_id", return_value=user):
        token = create_access_token(user.id, user.role.value)
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.put(
                "/api/auth/profile",
                json={"timezone": "Foo/Bar"},
                headers={"Authorization": f"Bearer {token}"},
            )

    # Pydantic validation error surfaces as 422 Unprocessable Entity in
    # FastAPI; treat anything in the 4xx band as a rejection.
    assert 400 <= response.status_code < 500
    assert response.status_code != 403  # not an auth problem


@pytest.mark.asyncio
async def test_put_profile_accepts_iana_timezone():
    """PUT /api/auth/profile with a valid IANA name updates and echoes it."""
    user = _make_user(tz="UTC")

    # Stub commit/refresh/execute so the endpoint does not touch a real DB.
    # ``execute`` is needed because the post-commit reschedule helper queries
    # for the user's PulseSettings row.
    from app.core.database import get_db

    class _StubResult:
        def scalar_one_or_none(self):
            return None

    class _StubSession:
        async def commit(self):
            return None

        async def refresh(self, obj):
            return None

        async def execute(self, _stmt):
            return _StubResult()

    async def _stub_db():
        yield _StubSession()

    app.dependency_overrides[get_db] = _stub_db
    try:
        with patch("app.core.deps.get_user_by_id", return_value=user), \
             patch("app.api.auth.apply_user_timezone_change") as mock_apply:
            token = create_access_token(user.id, user.role.value)
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.put(
                    "/api/auth/profile",
                    json={"timezone": "Europe/Berlin"},
                    headers={"Authorization": f"Bearer {token}"},
                )
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["timezone"] == "Europe/Berlin"
    # And the in-memory user was actually mutated.
    assert user.timezone == "Europe/Berlin"
    # And the scheduler reconciliation helper was invoked with the new tz.
    mock_apply.assert_awaited_once()
    args, _kwargs = mock_apply.call_args
    assert args[1] == user.id
    assert args[2] == "Europe/Berlin"


# ---------------------------------------------------------------------------
# core.timezone.get_user_tz now reads User.timezone
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_user_tz_reads_from_user_row():
    """``get_user_tz`` resolves via User.timezone (the new source of truth)."""
    from unittest.mock import AsyncMock, MagicMock
    from zoneinfo import ZoneInfo

    from app.core.timezone import get_user_tz

    db = AsyncMock()
    result = MagicMock()
    result.scalar.return_value = "Europe/Moscow"
    db.execute.return_value = result

    tz = await get_user_tz(db, user_id=1)
    assert tz == ZoneInfo("Europe/Moscow")


@pytest.mark.asyncio
async def test_get_user_tz_falls_back_to_utc_when_missing():
    """Missing/invalid timezone falls back to UTC without raising."""
    from unittest.mock import AsyncMock, MagicMock
    from zoneinfo import ZoneInfo

    from app.core.timezone import get_user_tz

    db = AsyncMock()
    result = MagicMock()
    result.scalar.return_value = None
    db.execute.return_value = result

    tz = await get_user_tz(db, user_id=1)
    assert tz == ZoneInfo("UTC")


# ---------------------------------------------------------------------------
# services.timezone.apply_user_timezone_change
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@patch("app.services.timezone.schedule_user_birthday_check")
@patch("app.services.timezone.schedule_user_digest")
async def test_apply_user_timezone_change_with_pulse_settings(
    mock_digest, mock_birthday
):
    """When the user has PulseSettings, both digest and birthday are rescheduled."""
    from datetime import time
    from unittest.mock import AsyncMock, MagicMock

    from app.models.telegram import PulseSettings
    from app.services.timezone import apply_user_timezone_change

    settings = PulseSettings()
    settings.id = 1
    settings.user_id = 1
    settings.digest_schedule = "daily"
    settings.digest_time = time(9, 0)
    settings.digest_day = None
    settings.digest_interval_days = None

    db = AsyncMock()
    result = MagicMock()
    result.scalar_one_or_none.return_value = settings
    db.execute.return_value = result

    await apply_user_timezone_change(db, user_id=1, new_tz="Europe/Berlin")

    mock_digest.assert_called_once()
    digest_kwargs = mock_digest.call_args.kwargs
    assert digest_kwargs["timezone"] == "Europe/Berlin"
    assert digest_kwargs["schedule"] == "daily"
    assert digest_kwargs["hour"] == 9
    assert digest_kwargs["minute"] == 0

    mock_birthday.assert_called_once_with(1, "Europe/Berlin")


@pytest.mark.asyncio
@patch("app.services.timezone.schedule_user_birthday_check")
@patch("app.services.timezone.schedule_user_digest")
async def test_apply_user_timezone_change_without_pulse_settings(
    mock_digest, mock_birthday
):
    """When the user has no PulseSettings, only birthday is rescheduled (no crash)."""
    from unittest.mock import AsyncMock, MagicMock

    from app.services.timezone import apply_user_timezone_change

    db = AsyncMock()
    result = MagicMock()
    result.scalar_one_or_none.return_value = None
    db.execute.return_value = result

    await apply_user_timezone_change(db, user_id=1, new_tz="America/New_York")

    mock_digest.assert_not_called()
    mock_birthday.assert_called_once_with(1, "America/New_York")


# ---------------------------------------------------------------------------
# PUT /api/auth/profile + PATCH /api/users/{id} — reschedule on tz change
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@patch("app.api.auth.apply_user_timezone_change")
async def test_put_profile_same_timezone_skips_reschedule(mock_apply):
    """No-op: PUT /api/auth/profile with the same tz should not re-register jobs."""
    user = _make_user(tz="Europe/Berlin")

    from app.core.database import get_db

    class _StubSession:
        async def commit(self):
            return None

        async def refresh(self, obj):
            return None

        async def execute(self, _stmt):  # defensive; should not be called
            raise AssertionError("execute should not be called on no-op tz")

    async def _stub_db():
        yield _StubSession()

    app.dependency_overrides[get_db] = _stub_db
    try:
        with patch("app.core.deps.get_user_by_id", return_value=user):
            token = create_access_token(user.id, user.role.value)
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.put(
                    "/api/auth/profile",
                    json={"timezone": "Europe/Berlin"},
                    headers={"Authorization": f"Bearer {token}"},
                )
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert response.status_code == 200, response.text
    mock_apply.assert_not_awaited()


@pytest.mark.asyncio
@patch("app.api.users.apply_user_timezone_change")
async def test_patch_user_reschedules_on_timezone_change(mock_apply):
    """PATCH /api/users/{id} with a new tz invokes the reschedule helper."""
    admin = _make_user(user_id=1, tz="UTC")
    admin.role = UserRole.admin
    target = _make_user(user_id=2, tz="UTC")

    from app.core.database import get_db

    class _StubResult:
        def __init__(self, value):
            self._value = value

        def scalar_one_or_none(self):
            return self._value

    class _StubSession:
        def __init__(self, row):
            self._row = row

        async def commit(self):
            return None

        async def refresh(self, obj):
            return None

        async def execute(self, _stmt):
            return _StubResult(self._row)

    async def _stub_db():
        yield _StubSession(target)

    app.dependency_overrides[get_db] = _stub_db
    try:
        with patch("app.core.deps.get_user_by_id", return_value=admin):
            token = create_access_token(admin.id, admin.role.value)
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.patch(
                    f"/api/users/{target.id}",
                    json={"timezone": "America/New_York"},
                    headers={"Authorization": f"Bearer {token}"},
                )
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert response.status_code == 200, response.text
    assert target.timezone == "America/New_York"
    mock_apply.assert_awaited_once()
    args, _kwargs = mock_apply.call_args
    assert args[1] == target.id
    assert args[2] == "America/New_York"


@pytest.mark.asyncio
@patch("app.api.users.apply_user_timezone_change")
async def test_patch_user_same_timezone_skips_reschedule(mock_apply):
    """PATCH with identical tz is a no-op for the scheduler helper."""
    admin = _make_user(user_id=1, tz="UTC")
    admin.role = UserRole.admin
    target = _make_user(user_id=2, tz="America/New_York")

    from app.core.database import get_db

    class _StubResult:
        def __init__(self, value):
            self._value = value

        def scalar_one_or_none(self):
            return self._value

    class _StubSession:
        def __init__(self, row):
            self._row = row

        async def commit(self):
            return None

        async def refresh(self, obj):
            return None

        async def execute(self, _stmt):
            return _StubResult(self._row)

    async def _stub_db():
        yield _StubSession(target)

    app.dependency_overrides[get_db] = _stub_db
    try:
        with patch("app.core.deps.get_user_by_id", return_value=admin):
            token = create_access_token(admin.id, admin.role.value)
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.patch(
                    f"/api/users/{target.id}",
                    json={"timezone": "America/New_York"},
                    headers={"Authorization": f"Bearer {token}"},
                )
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert response.status_code == 200, response.text
    mock_apply.assert_not_awaited()
