"""
Tests for vitals demo mode and dashboard summary endpoint.
Covers: dashboard vitals-summary with/without data, demo user read access,
demo user restrictions on connect/disconnect/sync/generate.
"""
from __future__ import annotations

import pytest
from datetime import date, datetime, timezone
from unittest.mock import AsyncMock, MagicMock

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


# -- Helpers ------------------------------------------------------------------


def make_user(user_id: int = 1, role: UserRole = UserRole.member) -> User:
    u = User()
    u.id = user_id
    u.role = role
    u.email = f"user{user_id}@example.com"
    u.display_name = f"User {user_id}"
    u.is_blocked = False
    u.must_change_password = False
    u.theme = "dark"
    u.created_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
    return u


def make_demo_user(user_id: int = 99) -> User:
    return make_user(user_id=user_id, role=UserRole.demo)


def _override_auth(user: User):
    """Create a dependency override for get_current_user."""
    async def _dep():
        return user
    return _dep


def make_garmin_connection(user_id: int = 1) -> GarminConnection:
    c = GarminConnection()
    c.id = 1
    c.user_id = user_id
    c.email_encrypted = "encrypted_email"
    c.password_encrypted = "encrypted_pass"
    c.garth_tokens_encrypted = "encrypted_tokens"
    c.is_active = True
    c.sync_interval_minutes = 240
    c.last_sync_at = datetime(2026, 3, 19, 12, 0, 0, tzinfo=timezone.utc)
    c.sync_status = "success"
    c.sync_error = None
    c.connected_at = datetime(2026, 3, 19, 10, 0, 0, tzinfo=timezone.utc)
    return c


def make_daily_metric(user_id: int = 1, metric_date: date | None = None) -> VitalsDailyMetric:
    m = VitalsDailyMetric()
    m.id = 1
    m.user_id = user_id
    m.date = metric_date or date.today()
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
    s.date = sleep_date or date.today()
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


def make_briefing(user_id: int = 1, briefing_date: date | None = None) -> VitalsBriefing:
    b = VitalsBriefing()
    b.id = 1
    b.user_id = user_id
    b.date = briefing_date or date.today()
    b.content = "Great recovery overnight. Your resting HR is stable at 58 bpm."
    b.generated_at = datetime(2026, 3, 20, 8, 0, 0, tzinfo=timezone.utc)
    return b


# -- Dashboard vitals-summary tests ------------------------------------------


class TestVitalsDashboardSummaryWithData:
    """Tests for GET /api/dashboard/vitals-summary with various data scenarios."""

    @pytest.mark.asyncio
    async def test_vitals_dashboard_summary_connected_with_data(self):
        """Dashboard summary returns metrics, sleep, connected=True when data exists."""
        user = make_user()
        metric = make_daily_metric(user_id=user.id)
        sleep = make_sleep(user_id=user.id)
        conn = make_garmin_connection(user_id=user.id)

        briefing = make_briefing(user_id=user.id)
        call_count = 0

        async def mock_execute(query):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                result.scalar.return_value = "UTC"
            elif call_count == 2:
                result.scalar_one_or_none.return_value = metric
            elif call_count == 3:
                result.scalar_one_or_none.return_value = sleep
            elif call_count == 4:
                result.scalar_one_or_none.return_value = conn
            elif call_count == 5:
                result.scalar_one_or_none.return_value = briefing
            elif call_count == 6:
                result.scalars.return_value.all.return_value = [metric]
            else:
                result.scalars.return_value.all.return_value = [sleep]
            return result

        from app.core.database import get_db as real_get_db
        from app.core.deps import get_current_user

        mock_db = AsyncMock()
        mock_db.execute = mock_execute

        app.dependency_overrides[get_current_user] = _override_auth(user)
        app.dependency_overrides[real_get_db] = lambda: mock_db
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.get("/api/dashboard/vitals-summary")

            assert resp.status_code == 200
            data = resp.json()
            assert data["connected"] is True
            assert data["metrics"] is not None
            assert data["metrics"]["steps"] == 8500
            assert data["sleep"] is not None
            assert data["sleep"]["sleep_score"] == 82
            assert data["last_sync_at"] is not None
            assert data["briefing_insight"] == "Great recovery overnight. Your resting HR is stable at 58 bpm."
        finally:
            app.dependency_overrides.pop(get_current_user, None)
            app.dependency_overrides.pop(real_get_db, None)

    @pytest.mark.asyncio
    async def test_vitals_dashboard_summary_connected_no_metrics(self):
        """Dashboard summary returns null metrics/sleep when connected but no data today."""
        user = make_user()
        conn = make_garmin_connection(user_id=user.id)

        call_count = 0

        async def mock_execute(query):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                result.scalar.return_value = "UTC"
            elif call_count <= 3:
                # metrics and sleep: no data today
                result.scalar_one_or_none.return_value = None
            elif call_count == 4:
                # connection
                result.scalar_one_or_none.return_value = conn
            elif call_count == 5:
                # briefing: none
                result.scalar_one_or_none.return_value = None
            else:
                result.scalars.return_value.all.return_value = []
            return result

        from app.core.database import get_db as real_get_db
        from app.core.deps import get_current_user

        mock_db = AsyncMock()
        mock_db.execute = mock_execute

        app.dependency_overrides[get_current_user] = _override_auth(user)
        app.dependency_overrides[real_get_db] = lambda: mock_db
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.get("/api/dashboard/vitals-summary")

            assert resp.status_code == 200
            data = resp.json()
            assert data["connected"] is True
            assert data["metrics"] is None
            assert data["sleep"] is None
        finally:
            app.dependency_overrides.pop(get_current_user, None)
            app.dependency_overrides.pop(real_get_db, None)

    @pytest.mark.asyncio
    async def test_vitals_dashboard_summary_not_connected(self):
        """Dashboard summary returns connected=False, null metrics/sleep when not connected."""
        user = make_user()

        async def mock_execute(query):
            result = MagicMock()
            result.scalar_one_or_none.return_value = None
            return result

        from app.core.database import get_db as real_get_db
        from app.core.deps import get_current_user

        mock_db = AsyncMock()
        mock_db.execute = mock_execute

        app.dependency_overrides[get_current_user] = _override_auth(user)
        app.dependency_overrides[real_get_db] = lambda: mock_db
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.get("/api/dashboard/vitals-summary")

            assert resp.status_code == 200
            data = resp.json()
            assert data["connected"] is False
            assert data["metrics"] is None
            assert data["sleep"] is None
            assert data["last_sync_at"] is None
        finally:
            app.dependency_overrides.pop(get_current_user, None)
            app.dependency_overrides.pop(real_get_db, None)


# -- Demo user can read vitals ------------------------------------------------


class TestDemoUserVitalsRead:
    """Demo user can read vitals endpoints (GET requests)."""

    @pytest.mark.asyncio
    async def test_demo_user_can_read_vitals_metrics(self):
        """Demo user can GET /api/vitals/metrics."""
        demo = make_demo_user()
        metrics = [make_daily_metric(user_id=demo.id)]
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = metrics

        mock_result = MagicMock()
        mock_result.scalars.return_value = mock_scalars

        from app.core.database import get_db as real_get_db
        from app.core.deps import get_current_user

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=mock_result)

        app.dependency_overrides[get_current_user] = _override_auth(demo)
        app.dependency_overrides[real_get_db] = lambda: mock_db
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.get(
                    "/api/vitals/metrics?start_date=2026-03-12&end_date=2026-03-19"
                )
            assert resp.status_code == 200
            data = resp.json()
            assert isinstance(data, list)
            assert len(data) == 1
        finally:
            app.dependency_overrides.pop(get_current_user, None)
            app.dependency_overrides.pop(real_get_db, None)

    @pytest.mark.asyncio
    async def test_demo_user_can_read_vitals_sleep(self):
        """Demo user can GET /api/vitals/sleep."""
        demo = make_demo_user()
        sleep_records = [make_sleep(user_id=demo.id)]
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = sleep_records

        mock_result = MagicMock()
        mock_result.scalars.return_value = mock_scalars

        from app.core.database import get_db as real_get_db
        from app.core.deps import get_current_user

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=mock_result)

        app.dependency_overrides[get_current_user] = _override_auth(demo)
        app.dependency_overrides[real_get_db] = lambda: mock_db
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.get(
                    "/api/vitals/sleep?start_date=2026-03-12&end_date=2026-03-19"
                )
            assert resp.status_code == 200
            data = resp.json()
            assert isinstance(data, list)
            assert len(data) == 1
        finally:
            app.dependency_overrides.pop(get_current_user, None)
            app.dependency_overrides.pop(real_get_db, None)

    @pytest.mark.asyncio
    async def test_demo_user_can_read_vitals_activities(self):
        """Demo user can GET /api/vitals/activities."""
        demo = make_demo_user()
        activities = [make_activity(user_id=demo.id)]
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = activities

        mock_result = MagicMock()
        mock_result.scalars.return_value = mock_scalars

        from app.core.database import get_db as real_get_db
        from app.core.deps import get_current_user

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=mock_result)

        app.dependency_overrides[get_current_user] = _override_auth(demo)
        app.dependency_overrides[real_get_db] = lambda: mock_db
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.get(
                    "/api/vitals/activities?start_date=2026-03-12&end_date=2026-03-19"
                )
            assert resp.status_code == 200
            data = resp.json()
            assert isinstance(data, list)
            assert len(data) == 1
        finally:
            app.dependency_overrides.pop(get_current_user, None)
            app.dependency_overrides.pop(real_get_db, None)

    @pytest.mark.asyncio
    async def test_demo_user_can_read_vitals_briefing(self):
        """Demo user can GET /api/vitals/briefing."""
        demo = make_demo_user()
        briefing = make_briefing(user_id=demo.id)

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = briefing

        from app.core.database import get_db as real_get_db
        from app.core.deps import get_current_user

        mock_db = AsyncMock()
        mock_db.execute = AsyncMock(return_value=mock_result)

        app.dependency_overrides[get_current_user] = _override_auth(demo)
        app.dependency_overrides[real_get_db] = lambda: mock_db
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.get("/api/vitals/briefing")
            assert resp.status_code == 200
            data = resp.json()
            assert "Great recovery" in data["content"]
        finally:
            app.dependency_overrides.pop(get_current_user, None)
            app.dependency_overrides.pop(real_get_db, None)


# -- Demo user cannot perform restricted actions ------------------------------


class TestDemoUserVitalsRestrictions:
    """Demo user is blocked from connect/disconnect/sync/generate endpoints."""

    @pytest.mark.asyncio
    async def test_demo_user_cannot_connect_garmin(self):
        """POST /api/vitals/connect returns 403 for demo user."""
        demo = make_demo_user()
        from app.core.deps import get_current_user

        app.dependency_overrides[get_current_user] = _override_auth(demo)
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.post(
                    "/api/vitals/connect",
                    json={"email": "test@garmin.com", "password": "secret"},
                )
            assert resp.status_code == 403
            assert "demo mode" in resp.json()["detail"].lower()
        finally:
            app.dependency_overrides.pop(get_current_user, None)

    @pytest.mark.asyncio
    async def test_demo_user_cannot_disconnect_garmin(self):
        """DELETE /api/vitals/disconnect returns 403 for demo user."""
        demo = make_demo_user()
        from app.core.deps import get_current_user

        app.dependency_overrides[get_current_user] = _override_auth(demo)
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.delete("/api/vitals/disconnect")
            assert resp.status_code == 403
            assert "demo mode" in resp.json()["detail"].lower()
        finally:
            app.dependency_overrides.pop(get_current_user, None)

    @pytest.mark.asyncio
    async def test_demo_user_cannot_sync(self):
        """POST /api/vitals/sync returns 403 for demo user."""
        demo = make_demo_user()
        from app.core.deps import get_current_user

        app.dependency_overrides[get_current_user] = _override_auth(demo)
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.post("/api/vitals/sync")
            assert resp.status_code == 403
            assert "demo mode" in resp.json()["detail"].lower()
        finally:
            app.dependency_overrides.pop(get_current_user, None)

    @pytest.mark.asyncio
    async def test_demo_user_cannot_generate_briefing(self):
        """POST /api/vitals/briefing/generate returns 403 for demo user."""
        demo = make_demo_user()
        from app.core.deps import get_current_user

        app.dependency_overrides[get_current_user] = _override_auth(demo)
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.post("/api/vitals/briefing/generate")
            assert resp.status_code == 403
            assert "demo mode" in resp.json()["detail"].lower()
        finally:
            app.dependency_overrides.pop(get_current_user, None)

    @pytest.mark.asyncio
    async def test_demo_user_cannot_update_sync_interval(self):
        """PATCH /api/vitals/sync-interval returns 403 for demo user."""
        demo = make_demo_user()
        from app.core.deps import get_current_user

        app.dependency_overrides[get_current_user] = _override_auth(demo)
        try:
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                resp = await client.patch(
                    "/api/vitals/sync-interval",
                    json={"interval_minutes": 120},
                )
            assert resp.status_code == 403
            assert "demo mode" in resp.json()["detail"].lower()
        finally:
            app.dependency_overrides.pop(get_current_user, None)
