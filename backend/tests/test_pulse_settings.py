"""
Tests for Pulse settings API and poll trigger endpoint.
Covers Phase 34 — Message Collection & Filtering.
"""
from __future__ import annotations

import pytest
from datetime import datetime, time, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from httpx import ASGITransport, AsyncClient

from app.main import app
from app.models.telegram import PulseSettings, PulseSource
from app.models.user import User, UserRole
from app.schemas.pulse_settings import PulseSettingsResponse, PulseSettingsUpdate


# ── Helpers ──────────────────────────────────────────────────────────────────


def make_user(user_id: int = 1) -> User:
    u = User()
    u.id = user_id
    u.role = UserRole.admin
    u.email = f"user{user_id}@example.com"
    u.display_name = f"User {user_id}"
    return u


def make_pulse_settings(user_id: int = 1) -> PulseSettings:
    s = PulseSettings()
    s.id = 1
    s.user_id = user_id
    s.polling_interval_minutes = 60
    s.digest_schedule = "daily"
    s.digest_time = time(9, 0)
    s.digest_day = None
    s.digest_interval_days = None
    s.message_ttl_days = 30
    s.notify_digest_ready = True
    s.notify_urgent_jobs = True
    s.poll_message_limit = 100
    s.updated_at = datetime(2026, 3, 16, 12, 0, 0, tzinfo=timezone.utc)
    return s


# ── Schema tests ─────────────────────────────────────────────────────────────


class TestPulseSettingsSchemas:
    def test_settings_schema(self):
        ps = make_pulse_settings()
        resp = PulseSettingsResponse.model_validate(ps)
        assert resp.polling_interval_minutes == 60
        assert resp.digest_schedule == "daily"
        assert resp.message_ttl_days == 30

    def test_settings_schema_poll_message_limit(self):
        ps = make_pulse_settings()
        resp = PulseSettingsResponse.model_validate(ps)
        assert resp.poll_message_limit == 100

    def test_update_schema_partial(self):
        data = PulseSettingsUpdate(polling_interval_minutes=30)
        dumped = data.model_dump(exclude_unset=True)
        assert dumped == {"polling_interval_minutes": 30}

    def test_update_schema_poll_message_limit(self):
        data = PulseSettingsUpdate(poll_message_limit=200)
        dumped = data.model_dump(exclude_unset=True)
        assert dumped == {"poll_message_limit": 200}


# ── Service tests ────────────────────────────────────────────────────────────


class TestPulseSettingsService:
    @pytest.mark.asyncio
    async def test_get_settings_creates_default(self):
        from app.services.pulse_settings import get_settings

        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        db.execute = AsyncMock(return_value=mock_result)

        settings = await get_settings(db, 1)

        db.add.assert_called_once()
        assert settings.user_id == 1

    @pytest.mark.asyncio
    @patch("app.services.pulse_settings.schedule_user_polling")
    async def test_update_settings(self, mock_schedule):
        from app.services.pulse_settings import update_settings

        existing = make_pulse_settings()
        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = existing
        db.execute = AsyncMock(return_value=mock_result)

        data = PulseSettingsUpdate(polling_interval_minutes=30, message_ttl_days=14)
        updated = await update_settings(db, 1, data)

        assert updated.polling_interval_minutes == 30
        assert updated.message_ttl_days == 14
        mock_schedule.assert_called_once_with(1, 30)


# ── API endpoint tests ───────────────────────────────────────────────────────


class TestPulseSettingsAPI:
    def setup_method(self):
        from app.core.deps import get_current_user

        self._user = make_user()
        app.dependency_overrides[get_current_user] = lambda: self._user

    def teardown_method(self):
        app.dependency_overrides.clear()

    @pytest.mark.asyncio
    @patch("app.services.pulse_settings.get_settings")
    async def test_api_get_settings(self, mock_get):
        mock_get.return_value = make_pulse_settings()

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/pulse/settings/")

        assert response.status_code == 200
        data = response.json()
        assert data["polling_interval_minutes"] == 60

    @pytest.mark.asyncio
    @patch("app.services.pulse_settings.update_settings")
    async def test_api_update_settings(self, mock_update):
        updated = make_pulse_settings()
        updated.polling_interval_minutes = 30
        mock_update.return_value = updated

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.put(
                "/api/pulse/settings/",
                json={"polling_interval_minutes": 30},
            )

        assert response.status_code == 200
        assert response.json()["polling_interval_minutes"] == 30

    @pytest.mark.asyncio
    async def test_update_schema_no_interval_no_reschedule(self):
        """Updating non-interval fields should not reschedule."""
        from app.services.pulse_settings import update_settings

        existing = make_pulse_settings()
        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = existing
        db.execute = AsyncMock(return_value=mock_result)

        with patch("app.services.pulse_settings.schedule_user_polling") as mock_schedule:
            data = PulseSettingsUpdate(message_ttl_days=7)
            await update_settings(db, 1, data)
            mock_schedule.assert_not_called()
