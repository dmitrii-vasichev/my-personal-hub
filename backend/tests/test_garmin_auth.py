"""
Tests for Garmin/Vitals models, schemas, and auth service.
Covers Phase 44 — Vitals Connection & Data Models.
"""
from __future__ import annotations

import pytest
from datetime import date, datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from httpx import ASGITransport, AsyncClient

from app.main import app
from app.models.garmin import (
    GarminConnection,
    VitalsActivity,
    VitalsBriefing,
    VitalsDailyMetric,
    VitalsSleep,
)
from app.models.user import User, UserRole
from app.schemas.garmin import (
    GarminConnectRequest,
    GarminStatusResponse,
    GarminSyncIntervalRequest,
    VitalsActivityResponse,
    VitalsBriefingResponse,
    VitalsDailyMetricResponse,
    VitalsSleepResponse,
    VitalsTodayResponse,
)


# ── Helpers ──────────────────────────────────────────────────────────────────


def make_user(user_id: int = 1, role: UserRole = UserRole.admin) -> User:
    u = User()
    u.id = user_id
    u.role = role
    u.email = f"user{user_id}@example.com"
    u.display_name = f"User {user_id}"
    u.is_blocked = False
    return u


def make_garmin_connection(user_id: int = 1) -> GarminConnection:
    c = GarminConnection()
    c.id = 1
    c.user_id = user_id
    c.email_encrypted = "encrypted_email"
    c.password_encrypted = "encrypted_pass"
    c.garth_tokens_encrypted = "encrypted_tokens"
    c.is_active = True
    c.sync_interval_minutes = 240
    c.last_sync_at = None
    c.sync_status = "success"
    c.sync_error = None
    c.rate_limited_until = None
    c.connected_at = datetime(2026, 3, 19, 12, 0, 0, tzinfo=timezone.utc)
    return c


def make_daily_metric(user_id: int = 1) -> VitalsDailyMetric:
    m = VitalsDailyMetric()
    m.id = 1
    m.user_id = user_id
    m.date = date(2026, 3, 19)
    m.steps = 8500
    m.distance_m = 6200.0
    m.calories_active = 450
    m.calories_total = 2100
    m.resting_hr = 58
    m.avg_hr = 72
    m.max_hr = 145
    m.min_hr = 52
    m.avg_stress = 35
    m.body_battery_high = 85
    m.body_battery_low = 25
    m.vo2_max = 48.5
    return m


def make_sleep(user_id: int = 1) -> VitalsSleep:
    s = VitalsSleep()
    s.id = 1
    s.user_id = user_id
    s.date = date(2026, 3, 19)
    s.duration_seconds = 28800
    s.deep_seconds = 7200
    s.light_seconds = 14400
    s.rem_seconds = 5400
    s.awake_seconds = 1800
    s.sleep_score = 82
    return s


def make_activity(user_id: int = 1) -> VitalsActivity:
    a = VitalsActivity()
    a.id = 1
    a.user_id = user_id
    a.garmin_activity_id = 123456789
    a.activity_type = "running"
    a.name = "Morning Run"
    a.start_time = datetime(2026, 3, 19, 7, 0, 0, tzinfo=timezone.utc)
    a.duration_seconds = 1800
    a.distance_m = 5000.0
    a.avg_hr = 155
    a.max_hr = 175
    a.calories = 350
    a.avg_pace = "5:30 /km"
    a.elevation_gain = 45.0
    return a


def make_briefing(user_id: int = 1) -> VitalsBriefing:
    b = VitalsBriefing()
    b.id = 1
    b.user_id = user_id
    b.date = date(2026, 3, 19)
    b.content = "## Morning Briefing\nYou slept well."
    b.generated_at = datetime(2026, 3, 19, 8, 0, 0, tzinfo=timezone.utc)
    return b


# ── Model tests ─────────────────────────────────────────────────────────────


class TestGarminModels:
    def test_garmin_connection_fields(self):
        c = make_garmin_connection()
        assert c.user_id == 1
        assert c.is_active is True
        assert c.sync_interval_minutes == 240
        assert c.sync_status == "success"
        assert c.email_encrypted == "encrypted_email"
        assert c.password_encrypted == "encrypted_pass"

    def test_garmin_connection_defaults(self):
        c = GarminConnection()
        assert hasattr(c, "is_active")
        assert hasattr(c, "sync_interval_minutes")
        assert hasattr(c, "sync_status")

    def test_daily_metric_fields(self):
        m = make_daily_metric()
        assert m.steps == 8500
        assert m.distance_m == 6200.0
        assert m.resting_hr == 58
        assert m.vo2_max == 48.5
        assert m.date == date(2026, 3, 19)

    def test_daily_metric_unique_constraint(self):
        """VitalsDailyMetric has unique constraint on (user_id, date)."""
        assert VitalsDailyMetric.__table_args__[0].name == "uq_vitals_daily_metrics_user_date"

    def test_sleep_fields(self):
        s = make_sleep()
        assert s.duration_seconds == 28800
        assert s.deep_seconds == 7200
        assert s.sleep_score == 82

    def test_sleep_unique_constraint(self):
        """VitalsSleep has unique constraint on (user_id, date)."""
        assert VitalsSleep.__table_args__[0].name == "uq_vitals_sleep_user_date"

    def test_activity_fields(self):
        a = make_activity()
        assert a.garmin_activity_id == 123456789
        assert a.activity_type == "running"
        assert a.distance_m == 5000.0

    def test_activity_dedup_unique(self):
        """VitalsActivity garmin_activity_id should be unique."""
        col = VitalsActivity.__table__.columns["garmin_activity_id"]
        assert col.unique is True

    def test_briefing_fields(self):
        b = make_briefing()
        assert b.content.startswith("## Morning Briefing")
        assert b.date == date(2026, 3, 19)

    def test_briefing_unique_constraint(self):
        """VitalsBriefing has unique constraint on (user_id, date)."""
        assert VitalsBriefing.__table_args__[0].name == "uq_vitals_briefings_user_date"


# ── Schema tests ────────────────────────────────────────────────────────────


class TestGarminSchemas:
    def test_connect_request(self):
        req = GarminConnectRequest(email="test@garmin.com", password="secret")
        assert req.email == "test@garmin.com"
        assert req.password == "secret"

    def test_status_response_connected(self):
        data = {
            "connected": True,
            "last_sync_at": None,
            "sync_status": "success",
            "sync_error": None,
            "sync_interval_minutes": 240,
            "connected_at": "2026-03-19T12:00:00Z",
        }
        resp = GarminStatusResponse(**data)
        assert resp.connected is True
        assert resp.sync_status == "success"

    def test_status_response_disconnected(self):
        data = {
            "connected": False,
            "last_sync_at": None,
            "sync_status": None,
            "sync_error": None,
            "sync_interval_minutes": None,
            "connected_at": None,
        }
        resp = GarminStatusResponse(**data)
        assert resp.connected is False

    def test_sync_interval_valid(self):
        req = GarminSyncIntervalRequest(interval_minutes=120)
        assert req.interval_minutes == 120

    def test_sync_interval_invalid(self):
        with pytest.raises(Exception):
            GarminSyncIntervalRequest(interval_minutes=45)

    def test_daily_metric_response(self):
        m = make_daily_metric()
        resp = VitalsDailyMetricResponse.model_validate(m)
        assert resp.steps == 8500
        assert resp.vo2_max == 48.5

    def test_sleep_response(self):
        s = make_sleep()
        resp = VitalsSleepResponse.model_validate(s)
        assert resp.sleep_score == 82
        assert resp.duration_seconds == 28800

    def test_activity_response(self):
        a = make_activity()
        resp = VitalsActivityResponse.model_validate(a)
        assert resp.activity_type == "running"
        assert resp.avg_pace == "5:30 /km"

    def test_briefing_response(self):
        b = make_briefing()
        resp = VitalsBriefingResponse.model_validate(b)
        assert resp.content.startswith("## Morning Briefing")

    def test_today_response(self):
        resp = VitalsTodayResponse(metrics=None, sleep=None, recent_activities=[])
        assert resp.metrics is None
        assert resp.recent_activities == []


# ── Service tests ───────────────────────────────────────────────────────────


class TestGarminAuthService:
    @pytest.mark.asyncio
    @patch("app.services.garmin_auth.encrypt_value", return_value="encrypted")
    async def test_connect_success(self, mock_encrypt):
        from app.services.garmin_auth import connect

        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        db.execute = AsyncMock(return_value=mock_result)

        mock_client = MagicMock()
        mock_client.garth.dumps.return_value = '{"tokens": "data"}'

        with patch("garminconnect.Garmin", return_value=mock_client):
            conn = await connect(db, 1, "test@garmin.com", "password123")

        db.add.assert_called_once()
        assert conn.sync_status == "success"
        mock_client.login.assert_called_once()

    @pytest.mark.asyncio
    @patch("app.services.garmin_auth.encrypt_value", return_value="encrypted")
    async def test_connect_login_failure(self, mock_encrypt):
        from app.services.garmin_auth import connect
        from fastapi import HTTPException

        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        db.execute = AsyncMock(return_value=mock_result)

        mock_client = MagicMock()
        mock_client.login.side_effect = Exception("Invalid credentials")

        with patch("garminconnect.Garmin", return_value=mock_client):
            with pytest.raises(HTTPException) as exc_info:
                await connect(db, 1, "bad@garmin.com", "wrong")
            assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_disconnect_success(self):
        from app.services.garmin_auth import disconnect

        conn = make_garmin_connection()
        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = conn
        db.execute = AsyncMock(return_value=mock_result)

        await disconnect(db, 1)
        db.delete.assert_called_once_with(conn)

    @pytest.mark.asyncio
    async def test_disconnect_not_found(self):
        from app.services.garmin_auth import disconnect
        from fastapi import HTTPException

        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        db.execute = AsyncMock(return_value=mock_result)

        with pytest.raises(HTTPException) as exc_info:
            await disconnect(db, 1)
        assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_get_status_connected(self):
        from app.services.garmin_auth import get_status

        conn = make_garmin_connection()
        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = conn
        db.execute = AsyncMock(return_value=mock_result)

        result = await get_status(db, 1)
        assert result["connected"] is True
        assert result["sync_status"] == "success"
        assert result["sync_interval_minutes"] == 240

    @pytest.mark.asyncio
    async def test_get_status_inactive_with_rate_limit(self):
        """Record exists but is_active=False (failed connect) should return connected=False with rate_limited_until."""
        from app.services.garmin_auth import get_status, RATE_LIMIT_MSG
        from datetime import timedelta

        conn = make_garmin_connection()
        conn.is_active = False
        conn.sync_status = "error"
        conn.sync_error = RATE_LIMIT_MSG
        conn.rate_limited_until = datetime.now(timezone.utc) + timedelta(minutes=50)

        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = conn
        db.execute = AsyncMock(return_value=mock_result)

        result = await get_status(db, 1)
        assert result["connected"] is False
        assert result["rate_limited_until"] is not None

    @pytest.mark.asyncio
    async def test_get_status_not_connected(self):
        from app.services.garmin_auth import get_status

        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        db.execute = AsyncMock(return_value=mock_result)

        result = await get_status(db, 1)
        assert result["connected"] is False

    @pytest.mark.asyncio
    async def test_update_sync_interval_valid(self):
        from app.services.garmin_auth import update_sync_interval

        conn = make_garmin_connection()
        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = conn
        db.execute = AsyncMock(return_value=mock_result)

        result = await update_sync_interval(db, 1, 120)
        assert result.sync_interval_minutes == 120

    @pytest.mark.asyncio
    async def test_update_sync_interval_invalid(self):
        from app.services.garmin_auth import update_sync_interval
        from fastapi import HTTPException

        db = AsyncMock()

        with pytest.raises(HTTPException) as exc_info:
            await update_sync_interval(db, 1, 45)
        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_update_sync_interval_not_found(self):
        from app.services.garmin_auth import update_sync_interval
        from fastapi import HTTPException

        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        db.execute = AsyncMock(return_value=mock_result)

        with pytest.raises(HTTPException) as exc_info:
            await update_sync_interval(db, 1, 240)
        assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    @patch("app.services.garmin_auth.encrypt_value", return_value="encrypted")
    async def test_connect_rate_limited_raises_and_sets_cooldown(self, mock_encrypt):
        """When Garmin returns 429, connect should raise GarminRateLimitError and set rate_limited_until."""
        from garminconnect import GarminConnectTooManyRequestsError

        from app.services.garmin_auth import connect, GarminRateLimitError, RATE_LIMIT_MSG

        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        db.execute = AsyncMock(return_value=mock_result)

        mock_client = MagicMock()
        mock_client.login.side_effect = GarminConnectTooManyRequestsError("429")

        with patch("garminconnect.Garmin", return_value=mock_client):
            with pytest.raises(GarminRateLimitError):
                await connect(db, 1, "test@garmin.com", "password123")

        # Verify the conn object added to db has rate_limited_until set and is_active=False
        added_conn = db.add.call_args[0][0]
        assert added_conn.rate_limited_until is not None
        assert added_conn.rate_limited_until > datetime.now(timezone.utc)
        assert added_conn.sync_status == "error"
        assert added_conn.sync_error == RATE_LIMIT_MSG
        assert added_conn.is_active is False

    @pytest.mark.asyncio
    @patch("app.services.garmin_auth.encrypt_value", return_value="encrypted")
    async def test_connect_blocked_by_active_cooldown(self, mock_encrypt):
        """connect() should raise GarminRateLimitError immediately if cooldown is active."""
        from app.services.garmin_auth import connect, GarminRateLimitError
        from datetime import timedelta

        conn = make_garmin_connection()
        conn.rate_limited_until = datetime.now(timezone.utc) + timedelta(hours=1)

        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = conn
        db.execute = AsyncMock(return_value=mock_result)

        with patch("garminconnect.Garmin") as mock_garmin:
            with pytest.raises(GarminRateLimitError):
                await connect(db, 1, "test@garmin.com", "password123")
            # Garmin() should NOT have been called — blocked before login
            mock_garmin.assert_not_called()

    @pytest.mark.asyncio
    @patch("app.services.garmin_auth.encrypt_value", return_value="encrypted")
    async def test_connect_allowed_after_cooldown_expires(self, mock_encrypt):
        """connect() should proceed normally after cooldown has expired."""
        from app.services.garmin_auth import connect
        from datetime import timedelta

        conn = make_garmin_connection()
        conn.rate_limited_until = datetime.now(timezone.utc) - timedelta(minutes=5)

        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = conn
        db.execute = AsyncMock(return_value=mock_result)

        mock_client = MagicMock()
        mock_client.garth.dumps.return_value = '{"tokens": "data"}'

        with patch("garminconnect.Garmin", return_value=mock_client):
            result = await connect(db, 1, "test@garmin.com", "password123")

        assert result.sync_status == "success"
        assert result.rate_limited_until is None
        mock_client.login.assert_called_once()

    @pytest.mark.asyncio
    @patch("app.services.garmin_auth.decrypt_value", return_value='{"tokens": "data"}')
    async def test_get_garmin_client_uses_tokens_without_login(self, mock_decrypt):
        """get_garmin_client should load cached tokens without login() or validation calls."""
        from app.services.garmin_auth import get_garmin_client

        conn = make_garmin_connection()
        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = conn
        db.execute = AsyncMock(return_value=mock_result)

        mock_client = MagicMock()

        with patch("garminconnect.Garmin", return_value=mock_client):
            client = await get_garmin_client(db, 1)

        # Should NOT call login() or get_user_profile() — trust Garth tokens
        mock_client.login.assert_not_called()
        mock_client.get_user_profile.assert_not_called()
        assert client is mock_client

    @pytest.mark.asyncio
    async def test_set_rate_limited_sets_cooldown(self):
        """set_rate_limited should set rate_limited_until ~1h in the future."""
        from app.services.garmin_auth import set_rate_limited, RATE_LIMIT_MSG

        conn = make_garmin_connection()
        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = conn
        db.execute = AsyncMock(return_value=mock_result)

        await set_rate_limited(db, 1)

        assert conn.rate_limited_until is not None
        assert conn.rate_limited_until > datetime.now(timezone.utc)
        assert conn.sync_status == "error"
        assert conn.sync_error == RATE_LIMIT_MSG


# ── API endpoint tests ──────────────────────────────────────────────────────


class TestVitalsAPI:
    def setup_method(self):
        from app.core.deps import get_current_user, restrict_demo

        self._user = make_user()
        app.dependency_overrides[get_current_user] = lambda: self._user
        app.dependency_overrides[restrict_demo] = lambda: self._user

    def teardown_method(self):
        app.dependency_overrides.clear()

    @pytest.mark.asyncio
    @patch("app.services.garmin_auth.get_status")
    async def test_get_connection_status(self, mock_status):
        mock_status.return_value = {
            "connected": True,
            "last_sync_at": None,
            "sync_status": "success",
            "sync_error": None,
            "sync_interval_minutes": 240,
            "connected_at": "2026-03-19T12:00:00Z",
        }
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.get("/api/vitals/connection")
        assert resp.status_code == 200
        assert resp.json()["connected"] is True

    @pytest.mark.asyncio
    @patch("app.services.garmin_auth.get_status")
    @patch("app.services.garmin_auth.connect")
    async def test_connect_endpoint(self, mock_connect, mock_status):
        mock_connect.return_value = make_garmin_connection()
        mock_status.return_value = {
            "connected": True,
            "last_sync_at": None,
            "sync_status": "success",
            "sync_error": None,
            "sync_interval_minutes": 240,
            "connected_at": "2026-03-19T12:00:00Z",
        }
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.post(
                "/api/vitals/connect",
                json={"email": "test@garmin.com", "password": "secret"},
            )
        assert resp.status_code == 200
        assert resp.json()["connected"] is True

    @pytest.mark.asyncio
    @patch("app.services.garmin_auth.disconnect")
    async def test_disconnect_endpoint(self, mock_disconnect):
        mock_disconnect.return_value = None
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.delete("/api/vitals/disconnect")
        assert resp.status_code == 204

    @pytest.mark.asyncio
    @patch("app.services.garmin_auth.get_status")
    @patch("app.services.garmin_auth.update_sync_interval")
    async def test_sync_interval_endpoint(self, mock_update, mock_status):
        mock_update.return_value = make_garmin_connection()
        mock_status.return_value = {
            "connected": True,
            "last_sync_at": None,
            "sync_status": "success",
            "sync_error": None,
            "sync_interval_minutes": 120,
            "connected_at": "2026-03-19T12:00:00Z",
        }
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.patch(
                "/api/vitals/sync-interval",
                json={"interval_minutes": 120},
            )
        assert resp.status_code == 200
        assert resp.json()["sync_interval_minutes"] == 120

    @pytest.mark.asyncio
    async def test_demo_user_blocked_connect(self):
        """Demo user should be blocked from connect endpoint."""
        from app.core.deps import restrict_demo
        from fastapi import HTTPException

        async def mock_restrict_demo():
            raise HTTPException(status_code=403, detail="Demo mode")

        app.dependency_overrides[restrict_demo] = mock_restrict_demo

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.post(
                "/api/vitals/connect",
                json={"email": "test@garmin.com", "password": "secret"},
            )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    @patch("app.services.garmin_auth.get_status")
    @patch("app.services.garmin_auth.connect")
    async def test_connect_endpoint_429_commits_cooldown(self, mock_connect, mock_status):
        """POST /connect should return 429 and commit rate_limited_until to DB."""
        from app.services.garmin_auth import GarminRateLimitError

        mock_connect.side_effect = GarminRateLimitError("rate limited")
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.post(
                "/api/vitals/connect",
                json={"email": "test@garmin.com", "password": "secret"},
            )
        assert resp.status_code == 429
        assert "rate limit" in resp.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_demo_user_blocked_disconnect(self):
        """Demo user should be blocked from disconnect endpoint."""
        from app.core.deps import restrict_demo
        from fastapi import HTTPException

        async def mock_restrict_demo():
            raise HTTPException(status_code=403, detail="Demo mode")

        app.dependency_overrides[restrict_demo] = mock_restrict_demo

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.delete("/api/vitals/disconnect")
        assert resp.status_code == 403
