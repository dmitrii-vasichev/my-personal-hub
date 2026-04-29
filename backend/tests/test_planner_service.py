"""Unit tests for the planner service layer.

Mocks ``AsyncSession`` at the method level (matching the convention used in
``test_calendar.py`` and the rest of this codebase). No live DB.
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.models.daily_plan import DailyPlan, PlanItem, PlanItemStatus
from app.models.reminder import Reminder, ReminderStatus
from app.models.user import User, UserRole
from app.schemas.planner import DailyPlanCreate, PlanItemCreate, PlanItemUpdate
from app.services import planner as planner_service


# ── Fixtures ─────────────────────────────────────────────────────────────────


def make_user(user_id: int = 1, tz: str = "UTC") -> User:
    u = User()
    u.id = user_id
    u.role = UserRole.member
    u.email = f"user{user_id}@example.com"
    u.display_name = f"User {user_id}"
    u.timezone = tz
    return u


def make_item(
    *,
    id_: int = 0,
    order: int = 0,
    title: str = "item",
    category: str | None = None,
    minutes_planned: int = 30,
    minutes_actual: int | None = None,
    status: PlanItemStatus = PlanItemStatus.pending,
) -> PlanItem:
    item = PlanItem()
    item.id = id_
    item.order = order
    item.title = title
    item.category = category
    item.minutes_planned = minutes_planned
    item.minutes_actual = minutes_actual
    item.status = status
    item.notes = None
    return item


def make_plan(
    *,
    plan_id: int = 1,
    user_id: int = 1,
    date_: date = date(2026, 4, 17),
    available_minutes: int = 480,
    items: list[PlanItem] | None = None,
    replans_count: int = 0,
    adherence_pct: float | None = None,
    planned_minutes: int = 0,
    completed_minutes: int = 0,
    categories_actual: dict | None = None,
) -> DailyPlan:
    p = DailyPlan()
    p.id = plan_id
    p.user_id = user_id
    p.date = date_
    p.available_minutes = available_minutes
    p.planned_minutes = planned_minutes
    p.completed_minutes = completed_minutes
    p.adherence_pct = adherence_pct
    p.replans_count = replans_count
    p.categories_planned = {}
    p.categories_actual = categories_actual or {}
    p.items = items or []
    return p


def _scalar_one_result(value):
    result = MagicMock()
    result.scalar_one_or_none.return_value = value
    return result


def _scalars_all_result(values: list):
    scalars = MagicMock()
    scalars.all.return_value = values
    result = MagicMock()
    result.scalars.return_value = scalars
    return result


# ── _recompute_aggregates (pure) ─────────────────────────────────────────────


class TestRecomputeAggregates:
    def test_mixed_statuses(self):
        """One done with actual, one pending, one skipped."""
        plan = make_plan(
            items=[
                make_item(
                    category="deep_work",
                    minutes_planned=120,
                    minutes_actual=100,
                    status=PlanItemStatus.done,
                ),
                make_item(
                    category="email",
                    minutes_planned=30,
                    status=PlanItemStatus.pending,
                ),
                make_item(
                    category="admin",
                    minutes_planned=45,
                    status=PlanItemStatus.skipped,
                ),
            ]
        )

        planner_service._recompute_aggregates(plan)

        assert plan.planned_minutes == 195
        assert plan.completed_minutes == 100
        assert plan.adherence_pct == pytest.approx(100 / 195)
        # Planned categories include every item (even skipped/pending).
        assert plan.categories_planned == {
            "deep_work": 120,
            "email": 30,
            "admin": 45,
        }
        # Actual categories only contain the done item.
        assert plan.categories_actual == {"deep_work": 100}

    def test_done_with_none_actual_counts_as_zero(self):
        """Done items with minutes_actual=None contribute 0, not their planned minutes."""
        plan = make_plan(
            items=[
                make_item(
                    category="deep_work",
                    minutes_planned=60,
                    minutes_actual=None,
                    status=PlanItemStatus.done,
                ),
                make_item(
                    category="deep_work",
                    minutes_planned=40,
                    minutes_actual=40,
                    status=PlanItemStatus.done,
                ),
            ]
        )

        planner_service._recompute_aggregates(plan)

        assert plan.planned_minutes == 100
        assert plan.completed_minutes == 40
        assert plan.adherence_pct == pytest.approx(0.4)
        assert plan.categories_actual == {"deep_work": 40}

    def test_empty_plan_has_zero_adherence(self):
        plan = make_plan(items=[])
        planner_service._recompute_aggregates(plan)
        assert plan.planned_minutes == 0
        assert plan.completed_minutes == 0
        assert plan.adherence_pct == 0.0
        assert plan.categories_planned == {}
        assert plan.categories_actual == {}

    def test_none_category_becomes_uncategorized(self):
        plan = make_plan(
            items=[
                make_item(
                    category=None,
                    minutes_planned=60,
                    minutes_actual=60,
                    status=PlanItemStatus.done,
                ),
            ]
        )
        planner_service._recompute_aggregates(plan)
        assert plan.categories_planned == {"uncategorized": 60}
        assert plan.categories_actual == {"uncategorized": 60}


# ── _longest_streak (pure) ───────────────────────────────────────────────────


class TestLongestStreak:
    def _plans(self, spec: list[tuple[date, float | None]]) -> dict[date, DailyPlan]:
        return {
            d: make_plan(date_=d, adherence_pct=a)
            for d, a in spec
        }

    def test_middle_streak_of_three(self):
        """[0.8, 0.5, 0.9, 0.9, 0.8] over 5 consecutive days → 3."""
        spec = [
            (date(2026, 4, 1), 0.8),
            (date(2026, 4, 2), 0.5),  # breaks streak
            (date(2026, 4, 3), 0.9),
            (date(2026, 4, 4), 0.9),
            (date(2026, 4, 5), 0.8),
        ]
        assert planner_service._longest_streak(self._plans(spec)) == 3

    def test_gap_breaks_streak(self):
        """0.9 on Apr 1 and Apr 3 (gap on Apr 2) → 1, not 2."""
        spec = [
            (date(2026, 4, 1), 0.9),
            (date(2026, 4, 3), 0.9),
        ]
        assert planner_service._longest_streak(self._plans(spec)) == 1

    def test_empty(self):
        assert planner_service._longest_streak({}) == 0

    def test_all_below_threshold(self):
        spec = [(date(2026, 4, 1), 0.5), (date(2026, 4, 2), 0.6)]
        assert planner_service._longest_streak(self._plans(spec)) == 0

    def test_threshold_boundary_inclusive(self):
        """0.7 exactly qualifies (>=)."""
        spec = [
            (date(2026, 4, 1), 0.7),
            (date(2026, 4, 2), 0.7),
        ]
        assert planner_service._longest_streak(self._plans(spec)) == 2


# ── upsert_plan ──────────────────────────────────────────────────────────────


@pytest.mark.asyncio
class TestUpsertPlan:
    async def test_first_time_creates_with_replans_zero(self):
        """No existing plan → insert new plan with replans_count=0."""
        db = AsyncMock()
        db.execute = AsyncMock(return_value=_scalar_one_result(None))
        added: list[object] = []
        db.add = MagicMock(side_effect=added.append)
        db.flush = AsyncMock()
        db.commit = AsyncMock()
        db.refresh = AsyncMock()

        user = make_user()
        payload = DailyPlanCreate(
            date=date(2026, 4, 17),
            available_minutes=480,
            items=[
                PlanItemCreate(
                    order=0,
                    title="Deep work",
                    category="deep_work",
                    minutes_planned=120,
                ),
                PlanItemCreate(
                    order=1,
                    title="Email",
                    category="email",
                    minutes_planned=30,
                ),
            ],
        )

        plan = await planner_service.upsert_plan(db, user, payload)

        assert plan.user_id == user.id
        assert plan.date == date(2026, 4, 17)
        assert plan.available_minutes == 480
        assert plan.replans_count == 0
        assert len(plan.items) == 2
        assert [i.title for i in plan.items] == ["Deep work", "Email"]
        # Aggregates computed before commit.
        assert plan.planned_minutes == 150
        assert plan.completed_minutes == 0
        assert plan.adherence_pct == 0.0
        assert plan.categories_planned == {"deep_work": 120, "email": 30}
        db.commit.assert_awaited()
        # ``db.add`` was called with the new plan.
        assert any(isinstance(o, DailyPlan) for o in added)

    async def test_second_time_increments_replans_and_replaces_items(self):
        """Existing plan: items wiped, new items in order, replans_count+1."""
        existing = make_plan(
            plan_id=7,
            replans_count=0,
            items=[
                make_item(
                    id_=11,
                    order=0,
                    title="Old item A",
                    minutes_planned=60,
                ),
                make_item(
                    id_=12,
                    order=1,
                    title="Old item B",
                    minutes_planned=60,
                ),
            ],
        )

        db = AsyncMock()
        db.execute = AsyncMock(return_value=_scalar_one_result(existing))
        db.add = MagicMock()
        db.flush = AsyncMock()
        db.commit = AsyncMock()
        db.refresh = AsyncMock()

        user = make_user()
        payload = DailyPlanCreate(
            date=existing.date,
            available_minutes=300,
            items=[
                PlanItemCreate(
                    order=0, title="New A", category="cat1", minutes_planned=50
                ),
                PlanItemCreate(
                    order=1, title="New B", category="cat2", minutes_planned=70
                ),
                PlanItemCreate(
                    order=2, title="New C", category="cat1", minutes_planned=20
                ),
            ],
        )

        plan = await planner_service.upsert_plan(db, user, payload)

        assert plan is existing
        assert plan.replans_count == 1
        assert plan.available_minutes == 300
        assert [i.title for i in plan.items] == ["New A", "New B", "New C"]
        assert all(i.id in (None, 0) for i in plan.items)  # fresh PlanItem objects
        # ``db.add`` is NOT called for an existing plan — it's already tracked.
        db.add.assert_not_called()


# ── update_item ──────────────────────────────────────────────────────────────


@pytest.mark.asyncio
class TestUpdateItem:
    async def test_updates_item_and_recomputes_aggregates(self):
        item = make_item(
            id_=55,
            order=0,
            category="deep_work",
            minutes_planned=120,
        )
        plan = make_plan(items=[item])

        db = AsyncMock()
        db.execute = AsyncMock(return_value=_scalar_one_result(plan))
        db.commit = AsyncMock()
        db.refresh = AsyncMock()

        user = make_user()
        payload = PlanItemUpdate(
            status=PlanItemStatus.done, minutes_actual=100
        )

        result = await planner_service.update_item(
            db, user, plan.date, 55, payload
        )

        assert result is item
        assert item.status == PlanItemStatus.done
        assert item.minutes_actual == 100
        # Aggregate recompute ran.
        assert plan.planned_minutes == 120
        assert plan.completed_minutes == 100
        assert plan.adherence_pct == pytest.approx(100 / 120)
        assert plan.categories_actual == {"deep_work": 100}

    async def test_missing_plan_returns_none(self):
        db = AsyncMock()
        db.execute = AsyncMock(return_value=_scalar_one_result(None))

        user = make_user()
        result = await planner_service.update_item(
            db, user, date(2026, 4, 17), 1, PlanItemUpdate(status=PlanItemStatus.done)
        )
        assert result is None

    async def test_cross_user_plan_not_returned(self):
        """Plan query filters by user_id, so another user's plan never
        reaches update_item — simulated by the mock returning None."""
        db = AsyncMock()
        db.execute = AsyncMock(return_value=_scalar_one_result(None))

        user = make_user(user_id=1)
        result = await planner_service.update_item(
            db, user, date(2026, 4, 17), 99, PlanItemUpdate(status=PlanItemStatus.done)
        )
        assert result is None

    async def test_item_not_in_plan_returns_none(self):
        plan = make_plan(items=[make_item(id_=10)])
        db = AsyncMock()
        db.execute = AsyncMock(return_value=_scalar_one_result(plan))

        user = make_user()
        result = await planner_service.update_item(
            db, user, plan.date, 999, PlanItemUpdate(status=PlanItemStatus.done)
        )
        assert result is None


# ── get_plan ─────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
class TestGetPlan:
    async def test_returns_plan_when_found(self):
        plan = make_plan()
        db = AsyncMock()
        db.execute = AsyncMock(return_value=_scalar_one_result(plan))

        user = make_user()
        result = await planner_service.get_plan(db, user, plan.date)
        assert result is plan

    async def test_returns_none_when_missing(self):
        db = AsyncMock()
        db.execute = AsyncMock(return_value=_scalar_one_result(None))

        user = make_user()
        result = await planner_service.get_plan(db, user, date(2026, 4, 17))
        assert result is None


# ── build_context ────────────────────────────────────────────────────────────


def _make_reminder(
    reminder_id: int,
    *,
    title: str = "ping",
    remind_at: datetime = datetime(2026, 4, 17, 9, 0, tzinfo=timezone.utc),
    is_urgent: bool = False,
) -> Reminder:
    r = Reminder()
    r.id = reminder_id
    r.title = title
    r.remind_at = remind_at
    r.action_date = None
    r.status = ReminderStatus.pending
    r.is_urgent = is_urgent
    return r


@pytest.mark.asyncio
class TestBuildContext:
    async def test_with_reminders_and_yesterday(self, monkeypatch):
        """Seeded reminders + yesterday plan → correct assembly."""
        reminders = [
            _make_reminder(10, title="Standup"),
            _make_reminder(11, title="Urgent!", is_urgent=True),
        ]
        yesterday = make_plan(
            plan_id=2,
            date_=date(2026, 4, 16),
            adherence_pct=0.85,
            completed_minutes=340,
            replans_count=2,
        )

        # Responses: reminders query, yesterday plan lookup.
        responses = [
            _scalars_all_result(reminders),
            _scalar_one_result(yesterday),
        ]
        db = AsyncMock()
        db.execute = AsyncMock(side_effect=responses)

        # Avoid touching User.timezone via a separate DB round-trip.
        async def fake_tz(_db, _uid):
            from zoneinfo import ZoneInfo
            return ZoneInfo("UTC")

        monkeypatch.setattr(planner_service, "get_user_tz", fake_tz)
        # Skip calendar to keep the test focused.
        monkeypatch.setattr(
            planner_service,
            "_load_calendar_events_for_date",
            AsyncMock(return_value=[]),
        )

        user = make_user()
        ctx = await planner_service.build_context(db, user, date(2026, 4, 17))

        assert ctx.date == date(2026, 4, 17)
        assert ctx.timezone == "UTC"
        assert [r.title for r in ctx.due_reminders] == ["Standup", "Urgent!"]
        assert ctx.calendar_events == []
        assert ctx.yesterday is not None
        assert ctx.yesterday.adherence_pct == 0.85
        assert ctx.yesterday.completed_minutes == 340
        assert ctx.yesterday.replans_count == 2

    async def test_without_yesterday_plan(self, monkeypatch):
        responses = [
            _scalars_all_result([]),
            _scalar_one_result(None),
        ]
        db = AsyncMock()
        db.execute = AsyncMock(side_effect=responses)

        async def fake_tz(_db, _uid):
            from zoneinfo import ZoneInfo
            return ZoneInfo("UTC")

        monkeypatch.setattr(planner_service, "get_user_tz", fake_tz)
        monkeypatch.setattr(
            planner_service,
            "_load_calendar_events_for_date",
            AsyncMock(return_value=[]),
        )

        user = make_user()
        ctx = await planner_service.build_context(db, user, date(2026, 4, 17))

        assert ctx.due_reminders == []
        assert ctx.yesterday is None


# ── compute_analytics ────────────────────────────────────────────────────────


@pytest.mark.asyncio
class TestComputeAnalytics:
    async def test_seven_plans_known_values(self):
        """7 seeded plans → correct avg_adherence, longest_streak, categories,
        days_count, daily_series length."""
        plans = [
            make_plan(
                plan_id=100 + i,
                date_=date(2026, 4, 10 + i),
                adherence_pct=adherence,
                planned_minutes=100,
                completed_minutes=int(100 * (adherence or 0)),
                replans_count=replans,
                categories_actual=cats,
            )
            for i, (adherence, replans, cats) in enumerate(
                [
                    (0.8, 0, {"deep_work": 80}),
                    (0.5, 1, {"deep_work": 50}),
                    (0.9, 0, {"deep_work": 70, "email": 20}),
                    (0.9, 0, {"deep_work": 90}),
                    (0.8, 2, {"email": 80}),
                    (0.6, 0, {"admin": 60}),
                    (0.75, 0, {"deep_work": 75}),
                ]
            )
        ]

        db = AsyncMock()
        db.execute = AsyncMock(return_value=_scalars_all_result(plans))

        user = make_user()
        out = await planner_service.compute_analytics(
            db, user, date(2026, 4, 10), date(2026, 4, 16)
        )

        assert out.days_count == 7
        assert len(out.daily_series) == 7
        assert out.total_planned_minutes == 700
        assert out.total_completed_minutes == sum(
            int(100 * a) for a in (0.8, 0.5, 0.9, 0.9, 0.8, 0.6, 0.75)
        )
        assert out.avg_adherence == pytest.approx(
            (0.8 + 0.5 + 0.9 + 0.9 + 0.8 + 0.6 + 0.75) / 7
        )
        assert out.replans_total == 3
        # Longest streak at >= 0.7: days 0, 2, 3, 4, 6 (indices).
        # Consecutive: 2,3,4 → streak of 3. Day 6 standalone (gap at 5) → 1.
        # Day 0 standalone (gap not needed — just length 1).
        assert out.longest_streak == 3
        assert out.minutes_by_category == {
            "deep_work": 80 + 50 + 70 + 90 + 75,
            "email": 20 + 80,
            "admin": 60,
        }

    async def test_empty_range_returns_zeros(self):
        db = AsyncMock()
        db.execute = AsyncMock(return_value=_scalars_all_result([]))

        user = make_user()
        out = await planner_service.compute_analytics(
            db, user, date(2026, 4, 1), date(2026, 4, 7)
        )

        assert out.days_count == 7
        assert out.daily_series == []
        assert out.total_planned_minutes == 0
        assert out.total_completed_minutes == 0
        assert out.avg_adherence is None
        assert out.longest_streak == 0
        assert out.replans_total == 0
        assert out.minutes_by_category == {}
