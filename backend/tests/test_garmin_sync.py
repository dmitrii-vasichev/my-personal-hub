"""
Tests for Garmin sync service and data query API endpoints.
Covers Phase 45 — Vitals Backend — Sync & Metrics Collection.
"""
from __future__ import annotations

import pytest
from datetime import date, datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from httpx import ASGITransport, AsyncClient

from app.main import app
from app.models.garmin import (
    GarminConnection,
    VitalsActivity,
    VitalsDailyMetric,
    VitalsSleep,
    VitalsSyncLog,
)
from app.models.user import User, UserRole
from app.schemas.garmin import VitalsDashboardSummaryResponse


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
    c.consecutive_failures = 0
    c.connected_at = datetime(2026, 3, 19, 12, 0, 0, tzinfo=timezone.utc)
    return c


def make_daily_metric(user_id: int = 1, metric_date: date | None = None) -> VitalsDailyMetric:
    m = VitalsDailyMetric()
    m.id = 1
    m.user_id = user_id
    m.date = metric_date or date(2026, 3, 19)
    m.steps = 8500
    m.distance_m = 6200.0
    m.calories_active = 450
    m.calories_total = 2100
    m.resting_hr = 58
    m.avg_hr = 72
    m.max_hr = 145
    m.min_hr = 52
    m.avg_stress = 35
    m.max_stress = 55
    m.body_battery_high = 85
    m.body_battery_low = 25
    m.vo2_max = 48.5
    return m


def make_sleep(user_id: int = 1, sleep_date: date | None = None) -> VitalsSleep:
    s = VitalsSleep()
    s.id = 1
    s.user_id = user_id
    s.date = sleep_date or date(2026, 3, 19)
    s.duration_seconds = 28800
    s.deep_seconds = 7200
    s.light_seconds = 14400
    s.rem_seconds = 5400
    s.awake_seconds = 1800
    s.sleep_score = 82
    return s


def make_activity(user_id: int = 1, activity_id: int = 123456789) -> VitalsActivity:
    a = VitalsActivity()
    a.id = 1
    a.user_id = user_id
    a.garmin_activity_id = activity_id
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


def make_garmin_api_summary():
    """Mock Garmin API user summary response."""
    return {
        "totalSteps": 8500,
        "totalDistanceMeters": 6200.0,
        "activeKilocalories": 450,
        "totalKilocalories": 2100,
        "floorsAscended": 12,
        "intensityMinutesGoal": 30,
        "restingHeartRate": 58,
        "averageHeartRate": 72,
        "maxHeartRate": 145,
        "minHeartRate": 52,
        "averageStressLevel": 35,
        "maxStressLevel": 55,
    }


def make_garmin_api_body_battery():
    """Mock Garmin API body battery response."""
    return [
        {"chargedValue": 85},
        {"chargedValue": 60},
        {"chargedValue": 25},
    ]


def make_garmin_api_sleep():
    """Mock Garmin API sleep response."""
    return {
        "dailySleepDTO": {
            "sleepTimeSeconds": 28800,
            "deepSleepSeconds": 7200,
            "lightSleepSeconds": 14400,
            "remSleepSeconds": 5400,
            "awakeSleepSeconds": 1800,
            "sleepScores": {"overall": {"value": 82}},
            "sleepStartTimestampGMT": 1774066800000,
            "sleepEndTimestampGMT": 1774095600000,
        }
    }


def make_garmin_api_activities():
    """Mock Garmin API activities response."""
    return [
        {
            "activityId": 123456789,
            "activityType": {"typeKey": "running"},
            "activityName": "Morning Run",
            "beginTimestamp": 1774090800000,
            "duration": 1800.0,
            "distance": 5000.0,
            "averageHR": 155,
            "maxHR": 175,
            "calories": 350,
            "averageSpeed": 3.03,
            "elevationGain": 45.0,
        },
        {
            "activityId": 987654321,
            "activityType": {"typeKey": "cycling"},
            "activityName": "Afternoon Ride",
            "beginTimestamp": 1774108800000,
            "duration": 3600.0,
            "distance": 25000.0,
            "averageHR": 140,
            "maxHR": 165,
            "calories": 600,
            "averageSpeed": 6.94,
            "elevationGain": 200.0,
        },
    ]


# ── Sync service unit tests ─────────────────────────────────────────────────


class TestGarminSyncService:
    @pytest.mark.asyncio
    @patch("app.services.garmin_sync.garmin_auth")
    async def test_sync_daily_metrics_create(self, mock_auth):
        """Test _sync_daily_metrics creates new metric record."""
        from app.services.garmin_sync import _sync_daily_metrics

        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        db.execute = AsyncMock(return_value=mock_result)

        client = MagicMock()
        client.get_user_summary.return_value = make_garmin_api_summary()
        client.get_body_battery.return_value = make_garmin_api_body_battery()
        client.get_max_metrics.return_value = {"generic": {"vo2MaxValue": 48.5}}

        await _sync_daily_metrics(db, 1, client, date(2026, 3, 19))

        db.add.assert_called_once()
        added = db.add.call_args[0][0]
        assert isinstance(added, VitalsDailyMetric)
        assert added.steps == 8500
        assert added.body_battery_high == 85
        assert added.body_battery_low == 25
        assert added.vo2_max == 48.5

    @pytest.mark.asyncio
    @patch("app.services.garmin_sync.garmin_auth")
    async def test_sync_daily_metrics_update(self, mock_auth):
        """Test _sync_daily_metrics updates existing record."""
        from app.services.garmin_sync import _sync_daily_metrics

        existing = make_daily_metric()
        existing.steps = 5000

        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = existing
        db.execute = AsyncMock(return_value=mock_result)

        client = MagicMock()
        client.get_user_summary.return_value = make_garmin_api_summary()
        client.get_body_battery.return_value = make_garmin_api_body_battery()
        client.get_max_metrics.return_value = {}

        await _sync_daily_metrics(db, 1, client, date(2026, 3, 19))

        db.add.assert_not_called()
        assert existing.steps == 8500

    @pytest.mark.asyncio
    async def test_sync_sleep_create(self):
        """Test _sync_sleep creates new sleep record."""
        from app.services.garmin_sync import _sync_sleep

        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        db.execute = AsyncMock(return_value=mock_result)

        client = MagicMock()
        client.get_sleep_data.return_value = make_garmin_api_sleep()

        await _sync_sleep(db, 1, client, date(2026, 3, 19))

        db.add.assert_called_once()
        added = db.add.call_args[0][0]
        assert isinstance(added, VitalsSleep)
        assert added.duration_seconds == 28800
        assert added.sleep_score == 82

    @pytest.mark.asyncio
    async def test_sync_sleep_update(self):
        """Test _sync_sleep updates existing record."""
        from app.services.garmin_sync import _sync_sleep

        existing = make_sleep()
        existing.sleep_score = 70

        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = existing
        db.execute = AsyncMock(return_value=mock_result)

        client = MagicMock()
        client.get_sleep_data.return_value = make_garmin_api_sleep()

        await _sync_sleep(db, 1, client, date(2026, 3, 19))

        db.add.assert_not_called()
        assert existing.sleep_score == 82

    @pytest.mark.asyncio
    async def test_sync_sleep_no_data(self):
        """Test _sync_sleep handles empty response."""
        from app.services.garmin_sync import _sync_sleep

        db = AsyncMock()
        client = MagicMock()
        client.get_sleep_data.return_value = {}

        await _sync_sleep(db, 1, client, date(2026, 3, 19))
        db.add.assert_not_called()

    @pytest.mark.asyncio
    async def test_sync_activities_create(self):
        """Test _sync_activities creates new activity records."""
        from app.services.garmin_sync import _sync_activities

        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        db.execute = AsyncMock(return_value=mock_result)

        client = MagicMock()
        client.get_activities_by_date.return_value = make_garmin_api_activities()

        await _sync_activities(db, 1, client, date(2026, 3, 12), date(2026, 3, 19))

        assert db.add.call_count == 2
        first_added = db.add.call_args_list[0][0][0]
        assert isinstance(first_added, VitalsActivity)
        assert first_added.garmin_activity_id == 123456789

    @pytest.mark.asyncio
    async def test_sync_activities_dedup(self):
        """Test _sync_activities skips update when activity already exists."""
        from app.services.garmin_sync import _sync_activities

        existing = make_activity()

        call_count = 0

        async def mock_execute(query):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                result.scalar_one_or_none.return_value = existing
            else:
                result.scalar_one_or_none.return_value = None
            return result

        db = AsyncMock()
        db.execute = mock_execute

        client = MagicMock()
        client.get_activities_by_date.return_value = make_garmin_api_activities()

        await _sync_activities(db, 1, client, date(2026, 3, 12), date(2026, 3, 19))

        # Only second activity should be added; first exists (updated in place)
        assert db.add.call_count == 1

    @pytest.mark.asyncio
    @patch("app.services.garmin_sync.garmin_auth")
    async def test_sync_user_data_success(self, mock_auth):
        """Test sync_user_data sets status to success on completion."""
        from app.services.garmin_sync import sync_user_data

        conn = make_garmin_connection()
        conn.last_sync_at = datetime(2026, 3, 18, 12, 0, 0, tzinfo=timezone.utc)

        call_count = 0

        async def mock_execute(query):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                result.scalar_one_or_none.return_value = conn
            else:
                result.scalar_one_or_none.return_value = None
            return result

        db = AsyncMock()
        db.execute = mock_execute

        mock_client = MagicMock()
        mock_client.get_user_summary.return_value = make_garmin_api_summary()
        mock_client.get_body_battery.return_value = make_garmin_api_body_battery()
        mock_client.get_max_metrics.return_value = {}
        mock_client.get_sleep_data.return_value = make_garmin_api_sleep()
        mock_client.get_activities_by_date.return_value = []
        mock_auth.get_garmin_client = AsyncMock(return_value=mock_client)

        await sync_user_data(db, 1)

        assert conn.sync_status == "success"
        assert conn.last_sync_at is not None
        assert conn.sync_error is None

    @pytest.mark.asyncio
    @patch("app.services.garmin_sync.garmin_auth")
    async def test_sync_user_data_error(self, mock_auth):
        """Test sync_user_data sets status to error on failure."""
        from app.services.garmin_sync import sync_user_data

        conn = make_garmin_connection()

        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = conn
        db.execute = AsyncMock(return_value=mock_result)

        mock_auth.get_garmin_client = AsyncMock(side_effect=Exception("API error"))

        with pytest.raises(Exception, match="API error"):
            await sync_user_data(db, 1)

        assert conn.sync_status == "error"
        assert "API error" in conn.sync_error

    @pytest.mark.asyncio
    @patch("app.services.garmin_sync.garmin_auth")
    async def test_sync_user_data_no_connection(self, mock_auth):
        """Test sync_user_data returns early if no connection."""
        from app.services.garmin_sync import sync_user_data

        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        db.execute = AsyncMock(return_value=mock_result)

        await sync_user_data(db, 1)

        mock_auth.get_garmin_client.assert_not_called()

    @pytest.mark.asyncio
    @patch("app.services.garmin_sync.garmin_auth")
    async def test_sync_skipped_during_cooldown(self, mock_auth):
        """Regression #728: sync must be skipped when rate_limited_until is in the future."""
        from app.services.garmin_sync import sync_user_data

        conn = make_garmin_connection()
        conn.rate_limited_until = datetime.now(timezone.utc) + timedelta(hours=1)

        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = conn
        db.execute = AsyncMock(return_value=mock_result)

        await sync_user_data(db, 1)

        # Should skip entirely — no API calls
        mock_auth.get_garmin_client.assert_not_called()

    @pytest.mark.asyncio
    @patch("app.services.garmin_sync.garmin_auth")
    async def test_sync_resumes_after_cooldown_expires(self, mock_auth):
        """Regression #728: sync must resume when rate_limited_until is in the past."""
        from app.services.garmin_sync import sync_user_data

        conn = make_garmin_connection()
        conn.rate_limited_until = datetime.now(timezone.utc) - timedelta(minutes=1)

        call_count = 0

        async def mock_execute(query):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                result.scalar_one_or_none.return_value = conn
            else:
                result.scalar_one_or_none.return_value = None
            return result

        db = AsyncMock()
        db.execute = mock_execute

        mock_client = MagicMock()
        mock_client.get_user_summary.return_value = make_garmin_api_summary()
        mock_client.get_body_battery.return_value = make_garmin_api_body_battery()
        mock_client.get_max_metrics.return_value = {}
        mock_client.get_sleep_data.return_value = {}
        mock_client.get_activities_by_date.return_value = []
        mock_auth.get_garmin_client = AsyncMock(return_value=mock_client)

        await sync_user_data(db, 1)

        assert conn.sync_status == "success"
        assert conn.rate_limited_until is None

    @pytest.mark.asyncio
    @patch("app.services.garmin_sync.garmin_auth")
    async def test_sync_aborts_on_429_and_sets_cooldown(self, mock_auth):
        """Regression #728: first 429 in any _sync_* must abort sync and trigger cooldown."""
        from garminconnect import GarminConnectTooManyRequestsError

        from app.services.garmin_sync import GarminRateLimitError, sync_user_data

        conn = make_garmin_connection()

        # Track set_rate_limited calls
        rate_limit_called = False

        async def mock_set_rate_limited(db, user_id):
            nonlocal rate_limit_called
            rate_limit_called = True
            conn.rate_limited_until = datetime.now(timezone.utc) + timedelta(hours=1)
            conn.sync_status = "error"
            conn.sync_error = "rate limited"

        call_count = 0

        async def mock_execute(query):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                result.scalar_one_or_none.return_value = conn
            else:
                result.scalar_one_or_none.return_value = None
            return result

        db = AsyncMock()
        db.execute = mock_execute

        # First API call returns 429
        mock_client = MagicMock()
        mock_client.get_user_summary.side_effect = GarminConnectTooManyRequestsError("429")
        mock_auth.get_garmin_client = AsyncMock(return_value=mock_client)
        mock_auth.set_rate_limited = mock_set_rate_limited

        with pytest.raises(GarminRateLimitError):
            await sync_user_data(db, 1)

        assert rate_limit_called is True
        # Should NOT have called sleep or activities — aborted after first 429
        mock_client.get_sleep_data.assert_not_called()
        mock_client.get_activities_by_date.assert_not_called()


class TestFormatPace:
    def test_normal_pace(self):
        from app.services.garmin_sync import _format_pace

        result = _format_pace(3.03, 5000.0)
        assert result == "5:30 /km"

    def test_zero_speed(self):
        from app.services.garmin_sync import _format_pace

        result = _format_pace(0, 5000.0)
        assert result is None

    def test_none_speed(self):
        from app.services.garmin_sync import _format_pace

        result = _format_pace(None, 5000.0)
        assert result is None


# ── Scheduler integration tests ──────────────────────────────────────────────


class TestGarminScheduler:
    @patch("app.core.scheduler.scheduler")
    def test_schedule_garmin_sync(self, mock_scheduler):
        from app.core.scheduler import schedule_garmin_sync

        mock_scheduler.get_job.return_value = None

        schedule_garmin_sync(1, 240)

        mock_scheduler.add_job.assert_called_once()
        call_kwargs = mock_scheduler.add_job.call_args
        assert call_kwargs[1]["id"] == "garmin_sync_1"
        assert call_kwargs[1]["minutes"] == 240

    @patch("app.core.scheduler.scheduler")
    def test_schedule_garmin_sync_reschedule(self, mock_scheduler):
        from app.core.scheduler import schedule_garmin_sync

        mock_scheduler.get_job.return_value = MagicMock()

        schedule_garmin_sync(1, 120)

        mock_scheduler.remove_job.assert_called_once_with("garmin_sync_1")
        mock_scheduler.add_job.assert_called_once()

    @patch("app.core.scheduler.scheduler")
    def test_remove_garmin_sync(self, mock_scheduler):
        from app.core.scheduler import remove_garmin_sync

        mock_scheduler.get_job.return_value = MagicMock()

        remove_garmin_sync(1)

        mock_scheduler.remove_job.assert_called_once_with("garmin_sync_1")

    @patch("app.core.scheduler.scheduler")
    def test_remove_garmin_sync_no_job(self, mock_scheduler):
        from app.core.scheduler import remove_garmin_sync

        mock_scheduler.get_job.return_value = None

        remove_garmin_sync(1)

        mock_scheduler.remove_job.assert_not_called()


# ── Background job test ──────────────────────────────────────────────────────


class TestBackgroundSyncJob:
    @pytest.mark.asyncio
    @patch("app.services.vitals_briefing.maybe_auto_generate_briefing")
    @patch("app.services.garmin_sync.sync_user_data")
    @patch("app.services.garmin_sync.async_session_factory")
    async def test_run_garmin_sync_success(self, mock_factory, mock_sync, mock_briefing):
        from app.services.garmin_sync import run_garmin_sync

        mock_db = AsyncMock()
        mock_factory.return_value.__aenter__ = AsyncMock(return_value=mock_db)
        mock_factory.return_value.__aexit__ = AsyncMock(return_value=False)
        mock_sync.return_value = None
        mock_briefing.return_value = None

        await run_garmin_sync(1)

        mock_sync.assert_called_once_with(mock_db, 1)
        # Two commits: one for sync, one for briefing
        assert mock_db.commit.call_count == 2

    @pytest.mark.asyncio
    @patch("app.services.garmin_sync.sync_user_data")
    @patch("app.services.garmin_sync.async_session_factory")
    async def test_run_garmin_sync_error_commits_state(self, mock_factory, mock_sync):
        """Regression #728: error state must be committed so cooldown persists."""
        from app.services.garmin_sync import run_garmin_sync

        mock_db = AsyncMock()
        mock_factory.return_value.__aenter__ = AsyncMock(return_value=mock_db)
        mock_factory.return_value.__aexit__ = AsyncMock(return_value=False)
        mock_sync.side_effect = Exception("sync failed")

        # Should not raise
        await run_garmin_sync(1)

        # Error state must be committed (not rolled back)
        mock_db.commit.assert_called_once()


# ── API endpoint tests ───────────────────────────────────────────────────────


class TestVitalsDataAPI:
    def setup_method(self):
        from app.core.deps import get_current_user, restrict_demo

        self._user = make_user()
        app.dependency_overrides[get_current_user] = lambda: self._user
        app.dependency_overrides[restrict_demo] = lambda: self._user

    def teardown_method(self):
        app.dependency_overrides.clear()

    @pytest.mark.asyncio
    @patch("app.services.garmin_auth.get_status")
    @patch("app.services.garmin_sync.sync_user_data")
    async def test_manual_sync_endpoint(self, mock_sync, mock_status):
        mock_sync.return_value = None
        mock_status.return_value = {
            "connected": True,
            "last_sync_at": "2026-03-19T12:00:00Z",
            "sync_status": "success",
            "sync_error": None,
            "sync_interval_minutes": 240,
            "connected_at": "2026-03-19T10:00:00Z",
        }
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.post("/api/vitals/sync")
        assert resp.status_code == 200
        assert resp.json()["sync_status"] == "success"

    @pytest.mark.asyncio
    @patch("app.services.garmin_sync.sync_user_data")
    async def test_manual_sync_429_returns_429_and_commits(self, mock_sync):
        """Bug #749: manual sync must commit cooldown state and return 429."""
        from app.services.garmin_sync import GarminRateLimitError

        mock_sync.side_effect = GarminRateLimitError("429 on get_user_summary")

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.post("/api/vitals/sync")

        assert resp.status_code == 429
        assert "rate limit" in resp.json()["detail"].lower()

    @pytest.mark.asyncio
    @patch("app.services.garmin_auth.get_status")
    @patch("app.services.garmin_sync.sync_user_data")
    async def test_manual_sync_status_includes_rate_limited_until(self, mock_sync, mock_status):
        """Bug #749: API response must include rate_limited_until field."""
        mock_sync.return_value = None
        rate_limit_time = "2026-03-20T15:00:00Z"
        mock_status.return_value = {
            "connected": True,
            "last_sync_at": "2026-03-20T12:00:00Z",
            "sync_status": "success",
            "sync_error": None,
            "sync_interval_minutes": 240,
            "connected_at": "2026-03-19T10:00:00Z",
            "rate_limited_until": rate_limit_time,
        }
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.post("/api/vitals/sync")
        assert resp.status_code == 200
        assert resp.json()["rate_limited_until"] == rate_limit_time

    @pytest.mark.asyncio
    async def test_demo_user_blocked_sync(self):
        from app.core.deps import restrict_demo
        from fastapi import HTTPException

        async def mock_restrict_demo():
            raise HTTPException(status_code=403, detail="Demo mode")

        app.dependency_overrides[restrict_demo] = mock_restrict_demo

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.post("/api/vitals/sync")
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_get_metrics_endpoint(self):
        metrics = [make_daily_metric()]
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = metrics

        mock_result = MagicMock()
        mock_result.scalars.return_value = mock_scalars

        with patch("app.api.garmin.get_db") as mock_get_db:
            mock_db = AsyncMock()
            mock_db.execute = AsyncMock(return_value=mock_result)

            async def db_gen():
                yield mock_db

            mock_get_db.return_value = db_gen()

            from app.core.database import get_db as real_get_db

            app.dependency_overrides[real_get_db] = lambda: mock_db

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.get("/api/vitals/metrics?start_date=2026-03-12&end_date=2026-03-19")

            app.dependency_overrides.pop(real_get_db, None)

        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) == 1
        assert data[0]["steps"] == 8500

    @pytest.mark.asyncio
    async def test_get_sleep_endpoint(self):
        sleep_records = [make_sleep()]
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = sleep_records

        mock_result = MagicMock()
        mock_result.scalars.return_value = mock_scalars

        from app.core.database import get_db as real_get_db

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=mock_result)
        app.dependency_overrides[real_get_db] = lambda: mock_db

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.get("/api/vitals/sleep?start_date=2026-03-12&end_date=2026-03-19")

        app.dependency_overrides.pop(real_get_db, None)

        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["sleep_score"] == 82

    @pytest.mark.asyncio
    async def test_get_activities_endpoint(self):
        activities = [make_activity()]
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = activities

        mock_result = MagicMock()
        mock_result.scalars.return_value = mock_scalars

        from app.core.database import get_db as real_get_db

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=mock_result)
        app.dependency_overrides[real_get_db] = lambda: mock_db

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.get("/api/vitals/activities?start_date=2026-03-12&end_date=2026-03-19")

        app.dependency_overrides.pop(real_get_db, None)

        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["activity_type"] == "running"

    @pytest.mark.asyncio
    async def test_get_today_endpoint(self, monkeypatch):
        from app.api import garmin as garmin_api

        async def fake_user_today(db, user_id):
            return date(2026, 3, 19)

        monkeypatch.setattr(garmin_api, "user_today", fake_user_today)

        metric = make_daily_metric()
        sleep = make_sleep()
        activity = make_activity()

        call_count = 0

        async def mock_execute(query):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                result.scalar_one_or_none.return_value = metric
            elif call_count == 2:
                result.scalar_one_or_none.return_value = sleep
            else:
                mock_scalars = MagicMock()
                mock_scalars.all.return_value = [activity]
                result.scalars.return_value = mock_scalars
            return result

        from app.core.database import get_db as real_get_db

        mock_db = AsyncMock()
        mock_db.execute = mock_execute
        app.dependency_overrides[real_get_db] = lambda: mock_db

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.get("/api/vitals/today")

        app.dependency_overrides.pop(real_get_db, None)

        assert resp.status_code == 200
        data = resp.json()
        assert data["metrics"]["steps"] == 8500
        assert data["sleep"]["sleep_score"] == 82
        assert len(data["recent_activities"]) == 1

    @pytest.mark.asyncio
    async def test_get_today_no_data(self):
        async def mock_execute(query):
            result = MagicMock()
            result.scalar_one_or_none.return_value = None
            mock_scalars = MagicMock()
            mock_scalars.all.return_value = []
            result.scalars.return_value = mock_scalars
            return result

        from app.core.database import get_db as real_get_db

        mock_db = AsyncMock()
        mock_db.execute = mock_execute
        app.dependency_overrides[real_get_db] = lambda: mock_db

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.get("/api/vitals/today")

        app.dependency_overrides.pop(real_get_db, None)

        assert resp.status_code == 200
        data = resp.json()
        assert data["metrics"] is None
        assert data["sleep"] is None
        assert data["recent_activities"] == []

    @pytest.mark.asyncio
    async def test_get_today_uses_user_timezone_date(self, monkeypatch):
        """Vitals today should read the same user-local date that sync writes."""
        from app.api import garmin as garmin_api

        metric = make_daily_metric(metric_date=date(2026, 3, 19))
        sleep = make_sleep(sleep_date=date(2026, 3, 19))
        activity = make_activity()
        user_local_today = date(2026, 3, 19)

        async def fake_user_today(db, user_id):
            return user_local_today

        monkeypatch.setattr(garmin_api, "user_today", fake_user_today, raising=False)

        async def mock_execute(query):
            compiled = str(query.compile(compile_kwargs={"literal_binds": True}))
            result = MagicMock()
            if "vitals_daily_metrics" in compiled:
                result.scalar_one_or_none.return_value = (
                    metric if "'2026-03-19'" in compiled else None
                )
            elif "vitals_sleep" in compiled:
                result.scalar_one_or_none.return_value = (
                    sleep if "'2026-03-19'" in compiled else None
                )
            else:
                mock_scalars = MagicMock()
                mock_scalars.all.return_value = [activity]
                result.scalars.return_value = mock_scalars
            return result

        from app.core.database import get_db as real_get_db

        mock_db = AsyncMock()
        mock_db.execute = mock_execute
        app.dependency_overrides[real_get_db] = lambda: mock_db

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.get("/api/vitals/today")

        app.dependency_overrides.pop(real_get_db, None)

        assert resp.status_code == 200
        data = resp.json()
        assert data["metrics"]["date"] == "2026-03-19"
        assert data["sleep"]["date"] == "2026-03-19"


class TestVitalsDashboardAPI:
    def setup_method(self):
        from app.core.deps import get_current_user

        self._user = make_user()
        app.dependency_overrides[get_current_user] = lambda: self._user

    def teardown_method(self):
        app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_vitals_summary_connected(self, monkeypatch):
        from app.api import garmin as garmin_api

        async def fake_user_today(db, user_id):
            return date(2026, 3, 19)

        monkeypatch.setattr(garmin_api, "user_today", fake_user_today)

        metric = make_daily_metric()
        sleep = make_sleep()
        conn = make_garmin_connection()
        conn.last_sync_at = datetime(2026, 3, 19, 12, 0, 0, tzinfo=timezone.utc)

        call_count = 0

        async def mock_execute(query):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                result.scalar_one_or_none.return_value = metric
            elif call_count == 2:
                result.scalar_one_or_none.return_value = sleep
            elif call_count == 3:
                result.scalar_one_or_none.return_value = conn
            else:
                # briefing query
                result.scalar_one_or_none.return_value = None
            return result

        from app.core.database import get_db as real_get_db

        mock_db = AsyncMock()
        mock_db.execute = mock_execute
        app.dependency_overrides[real_get_db] = lambda: mock_db

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.get("/api/dashboard/vitals-summary")

        app.dependency_overrides.pop(real_get_db, None)

        assert resp.status_code == 200
        data = resp.json()
        assert data["connected"] is True
        assert data["metrics"]["steps"] == 8500
        assert data["sleep"]["sleep_score"] == 82
        assert data["briefing_insight"] is None

    @pytest.mark.asyncio
    async def test_vitals_summary_not_connected(self):
        async def mock_execute(query):
            result = MagicMock()
            result.scalar_one_or_none.return_value = None
            return result

        from app.core.database import get_db as real_get_db

        mock_db = AsyncMock()
        mock_db.execute = mock_execute
        app.dependency_overrides[real_get_db] = lambda: mock_db

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.get("/api/dashboard/vitals-summary")

        app.dependency_overrides.pop(real_get_db, None)

        assert resp.status_code == 200
        data = resp.json()
        assert data["connected"] is False
        assert data["metrics"] is None
        assert data["sleep"] is None

    @pytest.mark.asyncio
    async def test_vitals_summary_uses_user_timezone_date(self, monkeypatch):
        """Dashboard vitals should read the user-local date used by Garmin sync."""
        from app.api import garmin as garmin_api

        metric = make_daily_metric(metric_date=date(2026, 3, 19))
        sleep = make_sleep(sleep_date=date(2026, 3, 19))
        conn = make_garmin_connection()
        conn.last_sync_at = datetime(2026, 3, 19, 12, 0, 0, tzinfo=timezone.utc)
        user_local_today = date(2026, 3, 19)

        async def fake_user_today(db, user_id):
            return user_local_today

        monkeypatch.setattr(garmin_api, "user_today", fake_user_today, raising=False)

        async def mock_execute(query):
            compiled = str(query.compile(compile_kwargs={"literal_binds": True}))
            result = MagicMock()
            mock_scalars = MagicMock()

            if "vitals_daily_metrics" in compiled and "ORDER BY" not in compiled:
                result.scalar_one_or_none.return_value = (
                    metric if "'2026-03-19'" in compiled else None
                )
            elif "vitals_sleep" in compiled and "ORDER BY" not in compiled:
                result.scalar_one_or_none.return_value = (
                    sleep if "'2026-03-19'" in compiled else None
                )
            elif "garmin_connections" in compiled:
                result.scalar_one_or_none.return_value = conn
            elif "vitals_briefings" in compiled:
                result.scalar_one_or_none.return_value = None
            elif "vitals_daily_metrics" in compiled:
                mock_scalars.all.return_value = (
                    [metric]
                    if "'2026-03-13'" in compiled and "'2026-03-19'" in compiled
                    else []
                )
                result.scalars.return_value = mock_scalars
            elif "vitals_sleep" in compiled:
                mock_scalars.all.return_value = (
                    [sleep]
                    if "'2026-03-13'" in compiled and "'2026-03-19'" in compiled
                    else []
                )
                result.scalars.return_value = mock_scalars
            return result

        from app.core.database import get_db as real_get_db

        mock_db = AsyncMock()
        mock_db.execute = mock_execute
        app.dependency_overrides[real_get_db] = lambda: mock_db

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.get("/api/dashboard/vitals-summary")

        app.dependency_overrides.pop(real_get_db, None)

        assert resp.status_code == 200
        data = resp.json()
        assert data["metrics"]["date"] == "2026-03-19"
        assert data["sleep"]["date"] == "2026-03-19"
        assert data["metrics_7d"][0]["date"] == "2026-03-19"


class TestDashboardSummarySchema:
    def test_schema_with_data(self):
        resp = VitalsDashboardSummaryResponse(
            connected=True,
            last_sync_at=datetime(2026, 3, 19, 12, 0, 0, tzinfo=timezone.utc),
        )
        assert resp.connected is True
        assert resp.metrics is None

    def test_schema_disconnected(self):
        resp = VitalsDashboardSummaryResponse()
        assert resp.connected is False
        assert resp.last_sync_at is None


# ── Auth service scheduler integration tests ─────────────────────────────────


class TestAuthSchedulerIntegration:
    @pytest.mark.asyncio
    @patch("app.services.garmin_auth.encrypt_value", return_value="encrypted")
    @patch("app.core.scheduler.schedule_garmin_sync")
    async def test_connect_schedules_sync(self, mock_schedule, mock_encrypt):
        from app.services.garmin_auth import connect

        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        db.execute = AsyncMock(return_value=mock_result)

        mock_client = MagicMock()
        mock_client.garth.dumps.return_value = '{"tokens": "data"}'

        with patch("garminconnect.Garmin", return_value=mock_client):
            await connect(db, 1, "test@garmin.com", "password123")

        mock_schedule.assert_called_once_with(1, 240)

    @pytest.mark.asyncio
    @patch("app.core.scheduler.remove_garmin_sync")
    async def test_disconnect_removes_sync(self, mock_remove):
        from app.services.garmin_auth import disconnect

        conn = make_garmin_connection()
        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = conn
        db.execute = AsyncMock(return_value=mock_result)

        await disconnect(db, 1)

        mock_remove.assert_called_once_with(1)

    @pytest.mark.asyncio
    @patch("app.core.scheduler.schedule_garmin_sync")
    async def test_update_interval_reschedules(self, mock_schedule):
        from app.services.garmin_auth import update_sync_interval

        conn = make_garmin_connection()
        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = conn
        db.execute = AsyncMock(return_value=mock_result)

        await update_sync_interval(db, 1, 120)

        mock_schedule.assert_called_once_with(1, 120)


# ── get_status auto-clear tests ──────────────────────────────────────────────


class TestGetStatusRateLimitAutoClear:
    @pytest.mark.asyncio
    async def test_get_status_clears_expired_rate_limit(self):
        """Bug #749: expired rate_limited_until should be auto-cleared in response."""
        from app.services.garmin_auth import get_status, RATE_LIMIT_MSG

        conn = make_garmin_connection()
        conn.rate_limited_until = datetime.now(timezone.utc) - timedelta(minutes=10)
        conn.sync_status = "error"
        conn.sync_error = RATE_LIMIT_MSG

        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = conn
        db.execute = AsyncMock(return_value=mock_result)

        result = await get_status(db, 1)
        assert result["rate_limited_until"] is None
        assert result["sync_error"] is None

    @pytest.mark.asyncio
    async def test_get_status_keeps_active_rate_limit(self):
        """Active rate_limited_until should be returned as-is."""
        from app.services.garmin_auth import get_status, RATE_LIMIT_MSG

        future_time = datetime.now(timezone.utc) + timedelta(minutes=30)
        conn = make_garmin_connection()
        conn.rate_limited_until = future_time
        conn.sync_status = "error"
        conn.sync_error = RATE_LIMIT_MSG

        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = conn
        db.execute = AsyncMock(return_value=mock_result)

        result = await get_status(db, 1)
        assert result["rate_limited_until"] == future_time
        assert result["sync_error"] == RATE_LIMIT_MSG

    @pytest.mark.asyncio
    async def test_get_status_no_connection(self):
        """No connection should return rate_limited_until=None."""
        from app.services.garmin_auth import get_status

        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        db.execute = AsyncMock(return_value=mock_result)

        result = await get_status(db, 1)
        assert result["rate_limited_until"] is None
        assert result["connected"] is False


# ── Sync Log tests (Phase 52) ─────────────────────────────────────────────


class TestSyncLogCreation:
    """Tests that sync_user_data creates VitalsSyncLog entries."""

    @pytest.mark.asyncio
    @patch("app.services.garmin_sync.garmin_auth")
    async def test_successful_sync_creates_log_entry(self, mock_auth):
        """Successful sync should create a VitalsSyncLog with status='success'."""
        from app.services.garmin_sync import sync_user_data

        conn = make_garmin_connection()
        mock_client = MagicMock()
        mock_client.get_user_summary.return_value = {"totalSteps": 5000}
        mock_client.get_body_battery.return_value = []
        mock_client.get_max_metrics.return_value = {}
        mock_client.get_sleep_data.return_value = {}
        mock_client.get_activities_by_date.return_value = []
        mock_auth.get_garmin_client = AsyncMock(return_value=mock_client)

        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = conn
        db.execute = AsyncMock(return_value=mock_result)

        added_objects = []
        db.add = lambda obj: added_objects.append(obj)

        await sync_user_data(db, 1)

        # Find sync log entries
        sync_logs = [o for o in added_objects if isinstance(o, VitalsSyncLog)]
        assert len(sync_logs) == 1
        log = sync_logs[0]
        assert log.status == "success"
        assert log.user_id == 1
        assert log.duration_ms is not None
        assert log.duration_ms >= 0
        assert log.records_synced is not None
        assert "metrics" in log.records_synced
        assert "sleep" in log.records_synced
        assert "activities" in log.records_synced
        assert conn.consecutive_failures == 0

    @pytest.mark.asyncio
    @patch("app.services.garmin_sync.garmin_auth")
    async def test_rate_limited_skip_creates_log_entry(self, mock_auth):
        """Rate-limited sync skip should create a VitalsSyncLog with status='rate_limited'."""
        from app.services.garmin_sync import sync_user_data

        conn = make_garmin_connection()
        conn.rate_limited_until = datetime.now(timezone.utc) + timedelta(hours=1)

        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = conn
        db.execute = AsyncMock(return_value=mock_result)

        added_objects = []
        db.add = lambda obj: added_objects.append(obj)

        await sync_user_data(db, 1)

        sync_logs = [o for o in added_objects if isinstance(o, VitalsSyncLog)]
        assert len(sync_logs) == 1
        log = sync_logs[0]
        assert log.status == "rate_limited"
        assert log.duration_ms == 0

    @pytest.mark.asyncio
    @patch("app.services.garmin_sync.garmin_auth")
    async def test_error_sync_creates_log_entry(self, mock_auth):
        """Failed sync should create a VitalsSyncLog with status='error'."""
        from app.services.garmin_sync import sync_user_data

        conn = make_garmin_connection()
        mock_auth.get_garmin_client = AsyncMock(side_effect=Exception("Connection refused"))

        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = conn
        db.execute = AsyncMock(return_value=mock_result)

        added_objects = []
        db.add = lambda obj: added_objects.append(obj)

        with pytest.raises(Exception, match="Connection refused"):
            await sync_user_data(db, 1)

        sync_logs = [o for o in added_objects if isinstance(o, VitalsSyncLog)]
        assert len(sync_logs) == 1
        log = sync_logs[0]
        assert log.status == "error"
        assert log.error_message == "Connection refused"
        assert log.duration_ms is not None

    @pytest.mark.asyncio
    @patch("app.services.garmin_sync.garmin_auth")
    async def test_rate_limit_error_creates_log_with_error_status(self, mock_auth):
        """429 during sync should create a log entry with status='error'."""
        from app.services.garmin_sync import sync_user_data
        from app.services.garmin_auth import GarminRateLimitError

        conn = make_garmin_connection()
        mock_client = MagicMock()
        from garminconnect import GarminConnectTooManyRequestsError
        mock_client.get_user_summary.side_effect = GarminConnectTooManyRequestsError("429")
        mock_auth.get_garmin_client = AsyncMock(return_value=mock_client)
        mock_auth.set_rate_limited = AsyncMock()

        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = conn
        db.execute = AsyncMock(return_value=mock_result)

        added_objects = []
        db.add = lambda obj: added_objects.append(obj)

        with pytest.raises(GarminRateLimitError):
            await sync_user_data(db, 1)

        sync_logs = [o for o in added_objects if isinstance(o, VitalsSyncLog)]
        assert len(sync_logs) == 1
        log = sync_logs[0]
        assert log.status == "error"
        assert "429" in (log.error_message or "").lower() or "rate" in (log.error_message or "").lower()


class TestSyncLogEndpoint:
    """Tests for GET /api/vitals/sync-log."""

    def setup_method(self):
        from app.core.deps import get_current_user
        from app.core.database import get_db

        self._user = make_user()
        app.dependency_overrides[get_current_user] = lambda: self._user

        # Create a mock db session that returns sync log entries
        log1 = VitalsSyncLog()
        log1.id = 1
        log1.user_id = 1
        log1.started_at = datetime(2026, 3, 21, 10, 0, 0, tzinfo=timezone.utc)
        log1.finished_at = datetime(2026, 3, 21, 10, 0, 5, tzinfo=timezone.utc)
        log1.status = "success"
        log1.error_message = None
        log1.records_synced = {"metrics": 2, "sleep": 2, "activities": 3}
        log1.duration_ms = 5000
        self._log1 = log1

        mock_db = AsyncMock()
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = [log1]
        mock_result = MagicMock()
        mock_result.scalars.return_value = mock_scalars
        mock_db.execute = AsyncMock(return_value=mock_result)
        app.dependency_overrides[get_db] = lambda: mock_db

    def teardown_method(self):
        app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_sync_log_endpoint_returns_entries(self):
        """GET /api/vitals/sync-log should return sync log entries."""
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.get("/api/vitals/sync-log")

        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["status"] == "success"
        assert data[0]["duration_ms"] == 5000
        assert data[0]["records_synced"]["metrics"] == 2


class TestConsecutiveFailuresReset:
    """Tests that consecutive_failures resets to 0 on successful sync."""

    @pytest.mark.asyncio
    @patch("app.services.garmin_sync.garmin_auth")
    async def test_success_resets_consecutive_failures(self, mock_auth):
        """After successful sync, consecutive_failures should be 0."""
        from app.services.garmin_sync import sync_user_data

        conn = make_garmin_connection()
        conn.consecutive_failures = 3  # had 3 prior failures
        mock_client = MagicMock()
        mock_client.get_user_summary.return_value = {}
        mock_client.get_body_battery.return_value = []
        mock_client.get_max_metrics.return_value = {}
        mock_client.get_sleep_data.return_value = {}
        mock_client.get_activities_by_date.return_value = []
        mock_auth.get_garmin_client = AsyncMock(return_value=mock_client)

        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = conn
        db.execute = AsyncMock(return_value=mock_result)
        db.add = lambda obj: None

        await sync_user_data(db, 1)

        assert conn.consecutive_failures == 0
        assert conn.rate_limited_until is None
        assert conn.sync_status == "success"
