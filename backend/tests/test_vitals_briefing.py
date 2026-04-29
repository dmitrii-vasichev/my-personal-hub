"""
Tests for Vitals AI Daily Briefing — Phase 46.
Covers snapshot collectors, prompt assembly, generation, API endpoints,
auto-generation, and cleanup.
"""
from __future__ import annotations

import pytest
from datetime import date, datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from httpx import ASGITransport, AsyncClient

from app.main import app
from app.models.garmin import (
    VitalsActivity,
    VitalsBriefing,
    VitalsDailyMetric,
    VitalsSleep,
)
from app.models.calendar import CalendarEvent
from app.models.job import Job
from app.models.user import User, UserRole


# ── Helpers ──────────────────────────────────────────────────────────────────


def make_user(user_id: int = 1, role: UserRole = UserRole.admin) -> User:
    u = User()
    u.id = user_id
    u.role = role
    u.email = f"user{user_id}@example.com"
    u.display_name = f"User {user_id}"
    u.is_blocked = False
    return u


def make_daily_metric(user_id: int = 1, metric_date: date | None = None) -> VitalsDailyMetric:
    m = VitalsDailyMetric()
    m.id = 1
    m.user_id = user_id
    m.date = metric_date or date(2026, 3, 20)
    m.steps = 8500
    m.distance_m = 6200.0
    m.calories_active = 450
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
    s.date = sleep_date or date(2026, 3, 20)
    s.duration_seconds = 28800
    s.deep_seconds = 7200
    s.light_seconds = 14400
    s.rem_seconds = 5400
    s.awake_seconds = 1800
    s.sleep_score = 82
    return s


def make_activity(
    user_id: int = 1,
    activity_id: int = 100,
    name: str = "Morning Run",
    activity_type: str = "running",
) -> VitalsActivity:
    a = VitalsActivity()
    a.id = activity_id
    a.user_id = user_id
    a.garmin_activity_id = activity_id
    a.activity_type = activity_type
    a.name = name
    a.start_time = datetime(2026, 3, 20, 7, 0, 0, tzinfo=timezone.utc)
    a.duration_seconds = 1800
    a.distance_m = 5000.0
    a.avg_hr = 155
    a.max_hr = 175
    a.calories = 350
    a.avg_pace = "5:30 /km"
    a.elevation_gain = 45.0
    return a


def make_briefing(
    user_id: int = 1, briefing_date: date | None = None
) -> VitalsBriefing:
    b = VitalsBriefing()
    b.id = 1
    b.user_id = user_id
    b.date = briefing_date or date(2026, 3, 20)
    b.content = "# Daily Briefing\n\nTest content"
    b.health_data_json = {"sleep": {}, "metrics": {}}
    b.actions_data_json = {"active_count": 5}
    b.calendar_data_json = {"events": []}
    b.jobs_data_json = {"active_count": 3}
    b.generated_at = datetime(2026, 3, 20, 8, 0, 0, tzinfo=timezone.utc)
    return b


# ── Test Health Snapshot ─────────────────────────────────────────────────────


class TestHealthSnapshot:
    @pytest.mark.asyncio
    async def test_full_data(self):
        from app.services.vitals_briefing import get_health_snapshot

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

        db = AsyncMock()
        db.execute = mock_execute

        snapshot = await get_health_snapshot(db, 1, date(2026, 3, 20))

        assert snapshot["sleep"]["sleep_score"] == 82
        assert snapshot["sleep"]["duration_seconds"] == 28800
        assert snapshot["metrics"]["steps"] == 8500
        assert snapshot["metrics"]["resting_hr"] == 58
        assert snapshot["body_battery"]["high"] == 85
        assert snapshot["body_battery"]["low"] == 25
        assert len(snapshot["activities"]) == 1
        assert snapshot["activities"][0]["type"] == "running"

    @pytest.mark.asyncio
    async def test_missing_data(self):
        from app.services.vitals_briefing import get_health_snapshot

        async def mock_execute(query):
            result = MagicMock()
            result.scalar_one_or_none.return_value = None
            mock_scalars = MagicMock()
            mock_scalars.all.return_value = []
            result.scalars.return_value = mock_scalars
            return result

        db = AsyncMock()
        db.execute = mock_execute

        snapshot = await get_health_snapshot(db, 1, date(2026, 3, 20))

        assert snapshot["sleep"]["sleep_score"] is None
        assert snapshot["metrics"]["steps"] is None
        assert snapshot["body_battery"]["high"] is None
        assert snapshot["activities"] == []


# ── Test Actions Snapshot ────────────────────────────────────────────────────


class TestActionsSnapshot:
    @pytest.mark.asyncio
    async def test_with_actions(self):
        from app.services.vitals_briefing import get_actions_snapshot

        call_count = 0

        async def mock_execute(query):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                # active_count
                result.scalar.return_value = 10
            elif call_count == 2:
                # overdue_count
                result.scalar.return_value = 2
            elif call_count == 3:
                # today's actions
                row = MagicMock()
                row.title = "Review PR"
                row.is_urgent = True
                result.all.return_value = [row]
            elif call_count == 4:
                # completed in 7d
                result.scalar.return_value = 7
            elif call_count == 5:
                # created in 7d
                result.scalar.return_value = 10
            return result

        db = AsyncMock()
        db.execute = mock_execute

        snapshot = await get_actions_snapshot(db, 1, date(2026, 3, 20))

        assert snapshot["active_count"] == 10
        assert snapshot["overdue_count"] == 2
        assert len(snapshot["todays_actions"]) == 1
        assert snapshot["todays_actions"][0]["title"] == "Review PR"
        assert snapshot["todays_actions"][0]["is_urgent"] is True
        assert snapshot["completion_rate_7d"] == 70

    @pytest.mark.asyncio
    async def test_no_actions(self):
        from app.services.vitals_briefing import get_actions_snapshot

        async def mock_execute(query):
            result = MagicMock()
            result.scalar.return_value = 0
            result.all.return_value = []
            return result

        db = AsyncMock()
        db.execute = mock_execute

        snapshot = await get_actions_snapshot(db, 1, date(2026, 3, 20))

        assert snapshot["active_count"] == 0
        assert snapshot["overdue_count"] == 0
        assert snapshot["todays_actions"] == []
        assert snapshot["completion_rate_7d"] == 0


# ── Test Calendar Snapshot ───────────────────────────────────────────────────


class TestCalendarSnapshot:
    @pytest.mark.asyncio
    async def test_with_events(self):
        from app.services.vitals_briefing import get_calendar_snapshot

        ev1 = MagicMock(spec=CalendarEvent)
        ev1.title = "Team standup"
        ev1.start_time = datetime(2026, 3, 20, 9, 0, 0, tzinfo=timezone.utc)
        ev1.end_time = datetime(2026, 3, 20, 9, 30, 0, tzinfo=timezone.utc)
        ev1.all_day = False

        ev2 = MagicMock(spec=CalendarEvent)
        ev2.title = "Technical Interview at Google"
        ev2.start_time = datetime(2026, 3, 20, 14, 0, 0, tzinfo=timezone.utc)
        ev2.end_time = datetime(2026, 3, 20, 15, 0, 0, tzinfo=timezone.utc)
        ev2.all_day = False

        mock_scalars = MagicMock()
        mock_scalars.all.return_value = [ev1, ev2]
        mock_result = MagicMock()
        mock_result.scalars.return_value = mock_scalars

        db = AsyncMock()
        db.execute = AsyncMock(return_value=mock_result)

        snapshot = await get_calendar_snapshot(db, 1, date(2026, 3, 20))

        assert len(snapshot["events"]) == 2
        assert snapshot["meetings_count"] == 2
        assert len(snapshot["interviews"]) == 1
        assert "Interview" in snapshot["interviews"][0]["title"]
        # Free block between 9:30 and 14:00 = 270 min
        assert len(snapshot["free_blocks"]) == 1
        assert snapshot["free_blocks"][0]["duration_minutes"] == 270

    @pytest.mark.asyncio
    async def test_interview_detection_russian(self):
        from app.services.vitals_briefing import get_calendar_snapshot

        ev = MagicMock(spec=CalendarEvent)
        ev.title = "Собеседование в Yandex"
        ev.start_time = datetime(2026, 3, 20, 10, 0, 0, tzinfo=timezone.utc)
        ev.end_time = datetime(2026, 3, 20, 11, 0, 0, tzinfo=timezone.utc)
        ev.all_day = False

        mock_scalars = MagicMock()
        mock_scalars.all.return_value = [ev]
        mock_result = MagicMock()
        mock_result.scalars.return_value = mock_scalars

        db = AsyncMock()
        db.execute = AsyncMock(return_value=mock_result)

        snapshot = await get_calendar_snapshot(db, 1, date(2026, 3, 20))

        assert len(snapshot["interviews"]) == 1

    @pytest.mark.asyncio
    async def test_no_events(self):
        from app.services.vitals_briefing import get_calendar_snapshot

        mock_scalars = MagicMock()
        mock_scalars.all.return_value = []
        mock_result = MagicMock()
        mock_result.scalars.return_value = mock_scalars

        db = AsyncMock()
        db.execute = AsyncMock(return_value=mock_result)

        snapshot = await get_calendar_snapshot(db, 1, date(2026, 3, 20))

        assert snapshot["events"] == []
        assert snapshot["meetings_count"] == 0
        assert snapshot["free_blocks"] == []


# ── Test Jobs Snapshot ───────────────────────────────────────────────────────


class TestJobsSnapshot:
    @pytest.mark.asyncio
    async def test_with_interviews(self):
        from app.services.vitals_briefing import get_jobs_snapshot

        job = MagicMock(spec=Job)
        job.company = "Google"
        job.title = "Senior Engineer"
        job.next_action_date = date(2026, 3, 21)
        job.next_action = "Technical interview"

        call_count = 0

        async def mock_execute(query):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                # upcoming interviews
                mock_scalars = MagicMock()
                mock_scalars.all.return_value = [job]
                result.scalars.return_value = mock_scalars
            elif call_count == 2:
                # active count
                result.scalar.return_value = 5
            elif call_count == 3:
                # pending actions
                mock_scalars = MagicMock()
                mock_scalars.all.return_value = [job]
                result.scalars.return_value = mock_scalars
            return result

        db = AsyncMock()
        db.execute = mock_execute

        snapshot = await get_jobs_snapshot(db, 1, date(2026, 3, 20))

        assert len(snapshot["upcoming_interviews"]) == 1
        assert snapshot["upcoming_interviews"][0]["company"] == "Google"
        assert snapshot["active_count"] == 5
        assert len(snapshot["pending_actions"]) == 1

    @pytest.mark.asyncio
    async def test_no_jobs(self):
        from app.services.vitals_briefing import get_jobs_snapshot

        async def mock_execute(query):
            result = MagicMock()
            result.scalar.return_value = 0
            mock_scalars = MagicMock()
            mock_scalars.all.return_value = []
            result.scalars.return_value = mock_scalars
            return result

        db = AsyncMock()
        db.execute = mock_execute

        snapshot = await get_jobs_snapshot(db, 1, date(2026, 3, 20))

        assert snapshot["upcoming_interviews"] == []
        assert snapshot["active_count"] == 0
        assert snapshot["pending_actions"] == []


# ── Test Prompt Assembly ─────────────────────────────────────────────────────


class TestPromptAssembly:
    def test_full_prompt(self):
        from app.services.vitals_briefing import _build_briefing_prompt

        health = {
            "sleep": {"duration_seconds": 28800, "sleep_score": 82, "deep_seconds": 7200, "rem_seconds": 5400, "light_seconds": 14400, "awake_seconds": 1800},
            "metrics": {"steps": 8500, "resting_hr": 58, "avg_hr": 72, "avg_stress": 35, "max_stress": 55, "calories_active": 450, "vo2_max": 48.5},
            "body_battery": {"high": 85, "low": 25},
            "activities": [{"type": "running", "name": "Morning Run", "duration_seconds": 1800, "start_time": "2026-03-20T07:00:00", "distance_m": 5000, "avg_hr": 155, "calories": 350}],
        }
        actions = {"active_count": 10, "overdue_count": 2, "todays_actions": [{"title": "Review PR", "is_urgent": True}], "completion_rate_7d": 70}
        calendar = {"events": [{"title": "Standup", "start_time": "2026-03-20T09:00:00", "end_time": "2026-03-20T09:30:00", "all_day": False}], "meetings_count": 1, "interviews": [], "free_blocks": []}
        jobs = {"upcoming_interviews": [{"company": "Google", "title": "SWE", "date": "2026-03-21", "next_action": "Interview"}], "active_count": 5, "pending_actions": []}

        prompt = _build_briefing_prompt(health, actions, calendar, jobs)

        assert "## Health Data (Garmin)" in prompt
        assert "8h 0m" in prompt
        assert "82/100" in prompt
        assert "Body Battery" in prompt
        assert "## Today's Schedule" in prompt
        assert "## Workload" in prompt
        assert "Active actions: 10" in prompt
        assert "## Job Hunt" in prompt
        assert "Google" in prompt
        assert "Health Status" in prompt
        assert "Recommendations" in prompt

    def test_missing_sections(self):
        from app.services.vitals_briefing import _build_briefing_prompt

        health = {
            "sleep": {"duration_seconds": None, "sleep_score": None, "deep_seconds": None, "rem_seconds": None, "light_seconds": None, "awake_seconds": None},
            "metrics": {"steps": None, "resting_hr": None, "avg_hr": None, "avg_stress": None, "max_stress": None, "calories_active": None, "vo2_max": None},
            "body_battery": {"high": None, "low": None},
            "activities": [],
        }

        prompt = _build_briefing_prompt(health, None, None, None)

        # Health section should be omitted since all values are None
        assert "## Health Data" not in prompt
        assert "No data available" in prompt

    def test_partial_data(self):
        from app.services.vitals_briefing import _build_briefing_prompt

        health = {
            "sleep": {"duration_seconds": 28800, "sleep_score": 82, "deep_seconds": 7200, "rem_seconds": 5400, "light_seconds": 14400, "awake_seconds": 1800},
            "metrics": {"steps": None, "resting_hr": None, "avg_hr": None, "avg_stress": None, "max_stress": None, "calories_active": None, "vo2_max": None},
            "body_battery": {"high": None, "low": None},
            "activities": [],
        }

        prompt = _build_briefing_prompt(health, None, None, None)

        assert "## Health Data (Garmin)" in prompt
        assert "Sleep:" in prompt


# ── Test Generation Service ──────────────────────────────────────────────────


class TestGenerationService:
    @pytest.mark.asyncio
    @patch("app.services.vitals_briefing.get_jobs_snapshot")
    @patch("app.services.vitals_briefing.get_calendar_snapshot")
    @patch("app.services.vitals_briefing.get_actions_snapshot")
    @patch("app.services.vitals_briefing.get_health_snapshot")
    @patch("app.services.vitals_briefing._get_llm_for_user")
    async def test_generate_new_briefing(
        self, mock_llm, mock_health, mock_actions, mock_cal, mock_jobs
    ):
        from app.services.vitals_briefing import generate_vitals_briefing

        mock_adapter = AsyncMock()
        mock_adapter.generate.return_value = "# Briefing\n\nAll good today."
        mock_llm.return_value = (mock_adapter, "openai")

        mock_health.return_value = {"sleep": {}, "metrics": {}, "body_battery": {}, "activities": []}
        mock_actions.return_value = {"active_count": 5, "overdue_count": 0, "todays_actions": [], "completion_rate_7d": 80}
        mock_cal.return_value = {"events": [], "meetings_count": 0, "interviews": [], "free_blocks": []}
        mock_jobs.return_value = {"upcoming_interviews": [], "active_count": 2, "pending_actions": []}

        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        db.execute = AsyncMock(return_value=mock_result)

        briefing = await generate_vitals_briefing(db, 1, date(2026, 3, 20))

        assert briefing is not None
        assert briefing.content == "# Briefing\n\nAll good today."
        assert briefing.user_id == 1
        db.add.assert_called_once()

    @pytest.mark.asyncio
    @patch("app.services.vitals_briefing.get_jobs_snapshot")
    @patch("app.services.vitals_briefing.get_calendar_snapshot")
    @patch("app.services.vitals_briefing.get_actions_snapshot")
    @patch("app.services.vitals_briefing.get_health_snapshot")
    @patch("app.services.vitals_briefing._get_llm_for_user")
    async def test_regenerate_existing_briefing(
        self, mock_llm, mock_health, mock_actions, mock_cal, mock_jobs
    ):
        from app.services.vitals_briefing import generate_vitals_briefing

        mock_adapter = AsyncMock()
        mock_adapter.generate.return_value = "# Updated briefing"
        mock_llm.return_value = (mock_adapter, "openai")

        mock_health.return_value = {"sleep": {}, "metrics": {}, "body_battery": {}, "activities": []}
        mock_actions.return_value = {"active_count": 5, "overdue_count": 0, "todays_actions": [], "completion_rate_7d": 80}
        mock_cal.return_value = {"events": [], "meetings_count": 0, "interviews": [], "free_blocks": []}
        mock_jobs.return_value = {"upcoming_interviews": [], "active_count": 2, "pending_actions": []}

        existing = make_briefing()
        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = existing
        db.execute = AsyncMock(return_value=mock_result)

        briefing = await generate_vitals_briefing(db, 1, date(2026, 3, 20))

        assert briefing is not None
        assert briefing.content == "# Updated briefing"
        db.add.assert_not_called()  # Updated in place

    @pytest.mark.asyncio
    @patch("app.services.vitals_briefing._get_llm_for_user")
    async def test_no_llm_configured(self, mock_llm):
        from app.services.vitals_briefing import generate_vitals_briefing

        mock_llm.return_value = None
        db = AsyncMock()

        result = await generate_vitals_briefing(db, 1, date(2026, 3, 20))

        assert result is None

    @pytest.mark.asyncio
    @patch("app.services.vitals_briefing.get_jobs_snapshot")
    @patch("app.services.vitals_briefing.get_calendar_snapshot")
    @patch("app.services.vitals_briefing.get_actions_snapshot")
    @patch("app.services.vitals_briefing.get_health_snapshot")
    @patch("app.services.vitals_briefing._get_llm_for_user")
    async def test_llm_failure_returns_none(
        self, mock_llm, mock_health, mock_actions, mock_cal, mock_jobs
    ):
        from app.services.vitals_briefing import generate_vitals_briefing

        mock_adapter = AsyncMock()
        mock_adapter.generate.side_effect = Exception("LLM API error")
        mock_llm.return_value = (mock_adapter, "openai")

        mock_health.return_value = {"sleep": {}, "metrics": {}, "body_battery": {}, "activities": []}
        mock_actions.return_value = {"active_count": 0, "overdue_count": 0, "todays_actions": [], "completion_rate_7d": 0}
        mock_cal.return_value = {"events": [], "meetings_count": 0, "interviews": [], "free_blocks": []}
        mock_jobs.return_value = {"upcoming_interviews": [], "active_count": 0, "pending_actions": []}

        db = AsyncMock()

        result = await generate_vitals_briefing(db, 1, date(2026, 3, 20))

        assert result is None


# ── Test API Endpoints ───────────────────────────────────────────────────────


class TestBriefingAPI:
    def setup_method(self):
        from app.core.deps import get_current_user, restrict_demo

        self._user = make_user()
        app.dependency_overrides[get_current_user] = lambda: self._user
        app.dependency_overrides[restrict_demo] = lambda: self._user

    def teardown_method(self):
        app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_get_briefing_found(self):
        briefing = make_briefing()

        from app.core.database import get_db as real_get_db

        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = briefing
        mock_db.execute = AsyncMock(return_value=mock_result)
        app.dependency_overrides[real_get_db] = lambda: mock_db

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.get("/api/vitals/briefing?date=2026-03-20")

        app.dependency_overrides.pop(real_get_db, None)

        assert resp.status_code == 200
        data = resp.json()
        assert data["content"] == "# Daily Briefing\n\nTest content"
        assert data["date"] == "2026-03-20"

    @pytest.mark.asyncio
    async def test_get_briefing_not_found(self):
        from app.core.database import get_db as real_get_db

        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute = AsyncMock(return_value=mock_result)
        app.dependency_overrides[real_get_db] = lambda: mock_db

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.get("/api/vitals/briefing?date=2026-03-20")

        app.dependency_overrides.pop(real_get_db, None)

        assert resp.status_code == 404

    @pytest.mark.asyncio
    @patch("app.services.vitals_briefing.generate_vitals_briefing")
    async def test_generate_briefing_success(self, mock_generate):
        briefing = make_briefing()
        mock_generate.return_value = briefing

        from app.core.database import get_db as real_get_db

        mock_db = AsyncMock()
        app.dependency_overrides[real_get_db] = lambda: mock_db

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.post("/api/vitals/briefing/generate")

        app.dependency_overrides.pop(real_get_db, None)

        assert resp.status_code == 200
        data = resp.json()
        assert data["content"] == "# Daily Briefing\n\nTest content"

    @pytest.mark.asyncio
    @patch("app.services.vitals_briefing.generate_vitals_briefing")
    async def test_generate_briefing_no_llm(self, mock_generate):
        mock_generate.return_value = None

        from app.core.database import get_db as real_get_db

        mock_db = AsyncMock()
        app.dependency_overrides[real_get_db] = lambda: mock_db

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.post("/api/vitals/briefing/generate")

        app.dependency_overrides.pop(real_get_db, None)

        assert resp.status_code == 400
        assert "LLM provider not configured" in resp.json()["detail"]

    @pytest.mark.asyncio
    async def test_demo_user_blocked_generate(self):
        from app.core.deps import restrict_demo
        from fastapi import HTTPException

        async def mock_restrict_demo():
            raise HTTPException(status_code=403, detail="Demo mode")

        app.dependency_overrides[restrict_demo] = mock_restrict_demo

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.post("/api/vitals/briefing/generate")

        assert resp.status_code == 403


# ── Test Auto-generation ─────────────────────────────────────────────────────


class TestAutoGeneration:
    @pytest.mark.asyncio
    @patch("app.services.vitals_briefing.user_today")
    @patch("app.services.vitals_briefing.generate_vitals_briefing")
    @patch("app.services.vitals_briefing._get_llm_for_user")
    async def test_auto_generate_first_sync(self, mock_llm, mock_generate, mock_today):
        from app.services.vitals_briefing import maybe_auto_generate_briefing

        call_count = 0
        metric = make_daily_metric()
        mock_today.return_value = metric.date

        async def mock_execute(query):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                # No existing briefing
                result.scalar_one_or_none.return_value = None
            elif call_count == 2:
                # Health data exists
                result.scalar_one_or_none.return_value = metric
            return result

        db = AsyncMock()
        db.execute = mock_execute
        mock_llm.return_value = (AsyncMock(), "openai")
        mock_generate.return_value = make_briefing()

        await maybe_auto_generate_briefing(db, 1)

        mock_generate.assert_called_once()

    @pytest.mark.asyncio
    async def test_auto_generate_skips_existing(self):
        from app.services.vitals_briefing import maybe_auto_generate_briefing

        existing = make_briefing()
        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = existing
        db.execute = AsyncMock(return_value=mock_result)

        with patch("app.services.vitals_briefing.generate_vitals_briefing") as mock_gen:
            await maybe_auto_generate_briefing(db, 1)
            mock_gen.assert_not_called()

    @pytest.mark.asyncio
    async def test_auto_generate_skips_no_health_data(self):
        from app.services.vitals_briefing import maybe_auto_generate_briefing

        call_count = 0

        async def mock_execute(query):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            result.scalar_one_or_none.return_value = None
            return result

        db = AsyncMock()
        db.execute = mock_execute

        with patch("app.services.vitals_briefing.generate_vitals_briefing") as mock_gen:
            await maybe_auto_generate_briefing(db, 1)
            mock_gen.assert_not_called()

    @pytest.mark.asyncio
    @patch("app.services.vitals_briefing._get_llm_for_user")
    async def test_auto_generate_skips_no_llm(self, mock_llm):
        from app.services.vitals_briefing import maybe_auto_generate_briefing

        metric = make_daily_metric()
        call_count = 0

        async def mock_execute(query):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                result.scalar_one_or_none.return_value = None
            elif call_count == 2:
                result.scalar_one_or_none.return_value = metric
            return result

        db = AsyncMock()
        db.execute = mock_execute
        mock_llm.return_value = None

        with patch("app.services.vitals_briefing.generate_vitals_briefing") as mock_gen:
            await maybe_auto_generate_briefing(db, 1)
            mock_gen.assert_not_called()


# ── Test Cleanup ─────────────────────────────────────────────────────────────


class TestCleanup:
    @pytest.mark.asyncio
    async def test_cleanup_old_briefings(self):
        from app.services.vitals_briefing import cleanup_old_briefings

        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.rowcount = 5
        db.execute = AsyncMock(return_value=mock_result)

        count = await cleanup_old_briefings(db)

        assert count == 5
        db.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_cleanup_nothing_to_delete(self):
        from app.services.vitals_briefing import cleanup_old_briefings

        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.rowcount = 0
        db.execute = AsyncMock(return_value=mock_result)

        count = await cleanup_old_briefings(db)

        assert count == 0


# ── Test Format Helpers ──────────────────────────────────────────────────────


class TestFormatHelpers:
    def test_format_seconds(self):
        from app.services.vitals_briefing import _format_seconds

        assert _format_seconds(28800) == "8h 0m"
        assert _format_seconds(7200) == "2h 0m"
        assert _format_seconds(5430) == "1h 30m"
        assert _format_seconds(None) == "N/A"
        assert _format_seconds(0) == "N/A"


# ── Test Post-Sync Hook ─────────────────────────────────────────────────────


class TestPostSyncHook:
    @pytest.mark.asyncio
    @patch("app.services.garmin_sync.sync_user_data")
    @patch("app.services.garmin_sync.async_session_factory")
    async def test_run_garmin_sync_calls_briefing(self, mock_factory, mock_sync):
        from app.services.garmin_sync import run_garmin_sync

        mock_db = AsyncMock()
        mock_factory.return_value.__aenter__ = AsyncMock(return_value=mock_db)
        mock_factory.return_value.__aexit__ = AsyncMock(return_value=False)
        mock_sync.return_value = None

        with patch("app.services.vitals_briefing.maybe_auto_generate_briefing") as mock_brief:
            mock_brief.return_value = None
            await run_garmin_sync(1)
            mock_brief.assert_called_once_with(mock_db, 1)

    @pytest.mark.asyncio
    @patch("app.services.garmin_sync.sync_user_data")
    @patch("app.services.garmin_sync.async_session_factory")
    async def test_briefing_failure_doesnt_break_sync(self, mock_factory, mock_sync):
        from app.services.garmin_sync import run_garmin_sync

        mock_db = AsyncMock()
        mock_factory.return_value.__aenter__ = AsyncMock(return_value=mock_db)
        mock_factory.return_value.__aexit__ = AsyncMock(return_value=False)
        mock_sync.return_value = None

        with patch("app.services.vitals_briefing.maybe_auto_generate_briefing") as mock_brief:
            mock_brief.side_effect = Exception("Briefing error")
            # Should not raise
            await run_garmin_sync(1)
            mock_sync.assert_called_once()
