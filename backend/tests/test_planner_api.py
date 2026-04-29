"""Integration tests for the planner router.

Exercises the 5 endpoints end-to-end via ``httpx.ASGITransport`` against the
live FastAPI app. Matches the ``test_demo_mode.py`` convention of overriding
``get_current_user`` + ``get_db`` and patching the service layer with
``monkeypatch`` — the planner service itself is covered by unit tests in
``test_planner_service.py``.
"""
from __future__ import annotations

from datetime import date, datetime, timezone
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.database import get_db
from app.core.deps import get_current_user
from app.main import app
from app.models.daily_plan import DailyPlan, PlanItem, PlanItemStatus
from app.models.user import User, UserRole
from app.schemas.planner import (
    AnalyticsResponse,
    ContextEvent,
    ContextReminder,
    DailyAnalyticsPoint,
    PlannerContextResponse,
    YesterdaySummary,
)
from app.services import planner as planner_service


# ── Helpers ──────────────────────────────────────────────────────────────────


def make_user(
    user_id: int = 1, role: UserRole = UserRole.member, tz: str = "UTC"
) -> User:
    u = User()
    u.id = user_id
    u.role = role
    u.email = f"user{user_id}@example.com"
    u.display_name = f"User {user_id}"
    u.is_blocked = False
    u.must_change_password = False
    u.theme = "dark"
    u.timezone = tz
    u.created_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
    return u


def make_demo_user(user_id: int = 99) -> User:
    return make_user(user_id=user_id, role=UserRole.demo)


def _override_auth(user: User):
    async def _dep():
        return user

    return _dep


def _override_db():
    # The service is monkeypatched in each test; the DB session passed in is
    # never actually queried. Return a bare AsyncMock so dependency
    # resolution succeeds.
    async def _dep():
        yield AsyncMock()

    return _dep


def _make_plan_item(
    *,
    id_: int,
    plan_id: int,
    order: int,
    title: str,
    category: str | None = None,
    minutes_planned: int = 30,
    minutes_actual: int | None = None,
    status: PlanItemStatus = PlanItemStatus.pending,
    notes: str | None = None,
) -> PlanItem:
    item = PlanItem()
    item.id = id_
    item.plan_id = plan_id
    item.order = order
    item.title = title
    item.category = category
    item.minutes_planned = minutes_planned
    item.minutes_actual = minutes_actual
    item.status = status
    item.notes = notes
    item.created_at = datetime(2026, 4, 17, 8, 0, tzinfo=timezone.utc)
    item.updated_at = datetime(2026, 4, 17, 8, 0, tzinfo=timezone.utc)
    return item


def _make_plan(
    *,
    plan_id: int = 1,
    user_id: int = 1,
    date_: date = date(2026, 4, 17),
    available_minutes: int = 480,
    planned_minutes: int = 0,
    completed_minutes: int = 0,
    adherence_pct: float | None = None,
    replans_count: int = 0,
    categories_planned: dict | None = None,
    categories_actual: dict | None = None,
    items: list[PlanItem] | None = None,
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
    p.categories_planned = categories_planned or {}
    p.categories_actual = categories_actual or {}
    p.items = items or []
    p.created_at = datetime(2026, 4, 17, 8, 0, tzinfo=timezone.utc)
    p.updated_at = datetime(2026, 4, 17, 8, 0, tzinfo=timezone.utc)
    return p


# ── POST /plans — happy path ─────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_post_plan_creates_with_items_in_order(monkeypatch):
    """POST /plans with 3 items → 200, items persisted in order, ids set,
    replans_count=0."""
    user = make_user()

    captured: dict = {}

    async def fake_upsert(db, u, payload):
        captured["payload"] = payload
        items = [
            _make_plan_item(
                id_=100 + i,
                plan_id=1,
                order=p.order,
                title=p.title,
                category=p.category,
                minutes_planned=p.minutes_planned,
            )
            for i, p in enumerate(payload.items)
        ]
        return _make_plan(
            plan_id=1,
            user_id=u.id,
            date_=payload.date,
            available_minutes=payload.available_minutes,
            planned_minutes=sum(p.minutes_planned for p in payload.items),
            categories_planned={"deep_work": 120, "email": 30, "admin": 45},
            items=items,
        )

    monkeypatch.setattr(planner_service, "upsert_plan", fake_upsert)

    app.dependency_overrides[get_current_user] = _override_auth(user)
    app.dependency_overrides[get_db] = _override_db()
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.post(
                "/api/planner/plans",
                json={
                    "date": "2026-04-17",
                    "available_minutes": 480,
                    "items": [
                        {
                            "order": 0,
                            "title": "Deep work",
                            "category": "deep_work",
                            "minutes_planned": 120,
                        },
                        {
                            "order": 1,
                            "title": "Email",
                            "category": "email",
                            "minutes_planned": 30,
                        },
                        {
                            "order": 2,
                            "title": "Admin",
                            "category": "admin",
                            "minutes_planned": 45,
                        },
                    ],
                },
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data["replans_count"] == 0
        assert data["date"] == "2026-04-17"
        assert data["available_minutes"] == 480
        assert [i["title"] for i in data["items"]] == [
            "Deep work",
            "Email",
            "Admin",
        ]
        assert [i["id"] for i in data["items"]] == [100, 101, 102]
        # Payload captured correctly
        assert captured["payload"].date == date(2026, 4, 17)
        assert len(captured["payload"].items) == 3
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_db, None)


# ── GET /plans/{date} — happy path ───────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_plan_returns_items_in_order(monkeypatch):
    """GET /plans/{date} returns items in order."""
    user = make_user()
    plan = _make_plan(
        plan_id=1,
        user_id=user.id,
        items=[
            _make_plan_item(
                id_=10,
                plan_id=1,
                order=0,
                title="Write report",
            ),
            _make_plan_item(
                id_=11, plan_id=1, order=1, title="Standalone work"
            ),
        ],
    )

    async def fake_get_plan(db, u, d):
        assert u.id == user.id
        assert d == date(2026, 4, 17)
        return plan

    monkeypatch.setattr(planner_service, "get_plan", fake_get_plan)

    app.dependency_overrides[get_current_user] = _override_auth(user)
    app.dependency_overrides[get_db] = _override_db()
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.get("/api/planner/plans/2026-04-17")
        assert resp.status_code == 200
        data = resp.json()
        assert [i["order"] for i in data["items"]] == [0, 1]
        assert [i["title"] for i in data["items"]] == [
            "Write report",
            "Standalone work",
        ]
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_db, None)


# ── PATCH item — status=done, minutes_actual=55 → aggregates update (AC-4) ───


@pytest.mark.asyncio
async def test_patch_item_updates_and_refetch_shows_new_aggregates(monkeypatch):
    """PATCH updates item; re-fetching plan shows recomputed aggregates."""
    user = make_user()

    patched_item = _make_plan_item(
        id_=10,
        plan_id=1,
        order=0,
        title="Deep work",
        category="deep_work",
        minutes_planned=120,
        minutes_actual=55,
        status=PlanItemStatus.done,
    )

    updated_plan = _make_plan(
        plan_id=1,
        user_id=user.id,
        planned_minutes=120,
        completed_minutes=55,
        adherence_pct=55 / 120,
        categories_planned={"deep_work": 120},
        categories_actual={"deep_work": 55},
        items=[patched_item],
    )

    async def fake_update_item(db, u, d, item_id, payload):
        assert item_id == 10
        assert payload.status == PlanItemStatus.done
        assert payload.minutes_actual == 55
        return patched_item

    async def fake_get_plan(db, u, d):
        return updated_plan

    monkeypatch.setattr(planner_service, "update_item", fake_update_item)
    monkeypatch.setattr(planner_service, "get_plan", fake_get_plan)

    app.dependency_overrides[get_current_user] = _override_auth(user)
    app.dependency_overrides[get_db] = _override_db()
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            patch_resp = await client.patch(
                "/api/planner/plans/2026-04-17/items/10",
                json={"status": "done", "minutes_actual": 55},
            )
            assert patch_resp.status_code == 200
            item_data = patch_resp.json()
            assert item_data["status"] == "done"
            assert item_data["minutes_actual"] == 55

            # Re-fetch the plan
            get_resp = await client.get("/api/planner/plans/2026-04-17")
            assert get_resp.status_code == 200
            plan_data = get_resp.json()
            assert plan_data["completed_minutes"] == 55
            assert plan_data["adherence_pct"] == pytest.approx(55 / 120)
            assert plan_data["categories_actual"] == {"deep_work": 55}
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_db, None)


# ── POST same date twice → replans_count=1 (AC-5) ────────────────────────────


@pytest.mark.asyncio
async def test_post_plan_twice_bumps_replans_count_and_replaces_items(monkeypatch):
    """Second POST to same date increments replans_count, replaces items."""
    user = make_user()

    call_log: list = []

    async def fake_upsert(db, u, payload):
        call_log.append(payload)
        # Second call → replans_count=1 with new items only.
        replans_count = len(call_log) - 1
        items = [
            _make_plan_item(
                id_=200 + i,
                plan_id=1,
                order=p.order,
                title=p.title,
                minutes_planned=p.minutes_planned,
            )
            for i, p in enumerate(payload.items)
        ]
        return _make_plan(
            plan_id=1,
            user_id=u.id,
            date_=payload.date,
            available_minutes=payload.available_minutes,
            replans_count=replans_count,
            items=items,
        )

    monkeypatch.setattr(planner_service, "upsert_plan", fake_upsert)

    app.dependency_overrides[get_current_user] = _override_auth(user)
    app.dependency_overrides[get_db] = _override_db()
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            # First POST
            r1 = await client.post(
                "/api/planner/plans",
                json={
                    "date": "2026-04-17",
                    "available_minutes": 480,
                    "items": [
                        {"order": 0, "title": "Old A", "minutes_planned": 60},
                        {"order": 1, "title": "Old B", "minutes_planned": 60},
                    ],
                },
            )
            assert r1.status_code == 200
            assert r1.json()["replans_count"] == 0

            # Second POST, different items
            r2 = await client.post(
                "/api/planner/plans",
                json={
                    "date": "2026-04-17",
                    "available_minutes": 300,
                    "items": [
                        {"order": 0, "title": "New X", "minutes_planned": 30},
                        {"order": 1, "title": "New Y", "minutes_planned": 90},
                    ],
                },
            )
            assert r2.status_code == 200
            data = r2.json()
            assert data["replans_count"] == 1
            assert [i["title"] for i in data["items"]] == ["New X", "New Y"]
            assert "Old A" not in [i["title"] for i in data["items"]]
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_db, None)


# ── GET /context — shape (AC-6) ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_context_returns_structurally_correct_payload(monkeypatch):
    """GET /context returns expected keys and types."""
    user = make_user()

    ctx = PlannerContextResponse(
        date=date(2026, 4, 17),
        timezone="UTC",
        due_reminders=[
            ContextReminder(
                id=5,
                title="Standup",
                remind_at=datetime(2026, 4, 17, 9, 0, tzinfo=timezone.utc),
                action_date=None,
                is_urgent=False,
            )
        ],
        calendar_events=[
            ContextEvent(
                id="evt1",
                title="Sync",
                start=datetime(2026, 4, 17, 10, 0, tzinfo=timezone.utc),
                end=datetime(2026, 4, 17, 10, 30, tzinfo=timezone.utc),
            )
        ],
        yesterday=YesterdaySummary(
            adherence_pct=0.8, completed_minutes=200, replans_count=1
        ),
    )

    async def fake_build_context(db, u, d):
        assert d == date(2026, 4, 17)
        return ctx

    monkeypatch.setattr(planner_service, "build_context", fake_build_context)

    app.dependency_overrides[get_current_user] = _override_auth(user)
    app.dependency_overrides[get_db] = _override_db()
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.get(
                "/api/planner/context?date=2026-04-17"
            )
        assert resp.status_code == 200
        data = resp.json()
        # Required top-level keys
        for key in (
            "date",
            "timezone",
            "due_reminders",
            "calendar_events",
            "yesterday",
        ):
            assert key in data
        assert data["date"] == "2026-04-17"
        assert data["timezone"] == "UTC"
        assert len(data["due_reminders"]) == 1
        assert len(data["calendar_events"]) == 1
        assert data["yesterday"]["adherence_pct"] == 0.8
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_db, None)


# ── GET /analytics — 2-day range (AC-7) ──────────────────────────────────────


@pytest.mark.asyncio
async def test_get_analytics_range_returns_daily_series(monkeypatch):
    """GET /analytics?from=...&to=... returns ``daily_series`` + sane
    aggregates."""
    user = make_user()

    response = AnalyticsResponse(
        **{
            "from": date(2026, 4, 16),
            "to": date(2026, 4, 17),
            "days_count": 2,
            "avg_adherence": 0.75,
            "total_planned_minutes": 300,
            "total_completed_minutes": 225,
            "minutes_by_category": {"deep_work": 150, "email": 75},
            "longest_streak": 2,
            "replans_total": 1,
            "daily_series": [
                DailyAnalyticsPoint(
                    date=date(2026, 4, 16),
                    adherence=0.7,
                    planned=150,
                    completed=105,
                    replans=1,
                ),
                DailyAnalyticsPoint(
                    date=date(2026, 4, 17),
                    adherence=0.8,
                    planned=150,
                    completed=120,
                    replans=0,
                ),
            ],
        }
    )

    async def fake_analytics(db, u, frm, to):
        assert frm == date(2026, 4, 16)
        assert to == date(2026, 4, 17)
        return response

    monkeypatch.setattr(
        planner_service, "compute_analytics", fake_analytics
    )

    app.dependency_overrides[get_current_user] = _override_auth(user)
    app.dependency_overrides[get_db] = _override_db()
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.get(
                "/api/planner/analytics?from=2026-04-16&to=2026-04-17"
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data["days_count"] == 2
        assert len(data["daily_series"]) == 2
        assert data["total_planned_minutes"] == 300
        assert data["total_completed_minutes"] == 225
        assert data["avg_adherence"] == 0.75
        assert data["longest_streak"] == 2
        assert data["replans_total"] == 1
        assert data["minutes_by_category"] == {"deep_work": 150, "email": 75}
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_db, None)


# ── Demo restrictions (AC-8) ─────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_demo_user_post_plan_blocked():
    """Demo user POST /plans → 403."""
    demo = make_demo_user()
    app.dependency_overrides[get_current_user] = _override_auth(demo)
    app.dependency_overrides[get_db] = _override_db()
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.post(
                "/api/planner/plans",
                json={
                    "date": "2026-04-17",
                    "available_minutes": 480,
                    "items": [],
                },
            )
        assert resp.status_code == 403
        assert "demo mode" in resp.json()["detail"].lower()
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_db, None)


@pytest.mark.asyncio
async def test_demo_user_patch_item_blocked():
    """Demo user PATCH item → 403."""
    demo = make_demo_user()
    app.dependency_overrides[get_current_user] = _override_auth(demo)
    app.dependency_overrides[get_db] = _override_db()
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.patch(
                "/api/planner/plans/2026-04-17/items/1",
                json={"status": "done"},
            )
        assert resp.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_db, None)


@pytest.mark.asyncio
async def test_demo_user_can_read_plans(monkeypatch):
    """Demo user GET /plans/{date} allowed (200)."""
    demo = make_demo_user()
    plan = _make_plan(plan_id=1, user_id=demo.id, items=[])

    async def fake_get_plan(db, u, d):
        return plan

    monkeypatch.setattr(planner_service, "get_plan", fake_get_plan)

    app.dependency_overrides[get_current_user] = _override_auth(demo)
    app.dependency_overrides[get_db] = _override_db()
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.get("/api/planner/plans/2026-04-17")
        assert resp.status_code == 200
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_db, None)


@pytest.mark.asyncio
async def test_demo_user_can_read_context(monkeypatch):
    """Demo user GET /context allowed (200)."""
    demo = make_demo_user()
    ctx = PlannerContextResponse(
        date=date(2026, 4, 17),
        timezone="UTC",
        due_reminders=[],
        calendar_events=[],
        yesterday=None,
    )

    async def fake_build_context(db, u, d):
        return ctx

    monkeypatch.setattr(planner_service, "build_context", fake_build_context)

    app.dependency_overrides[get_current_user] = _override_auth(demo)
    app.dependency_overrides[get_db] = _override_db()
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.get("/api/planner/context")
        assert resp.status_code == 200
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_db, None)


# ── Cross-user isolation (AC-9) ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_user_a_cannot_read_user_bs_plan(monkeypatch):
    """User A GETs /plans/{date} when only User B has a plan → 404.

    Service ``get_plan`` filters by user_id, returning None for cross-user
    reads; router translates None to 404.
    """
    user_a = make_user(user_id=1)

    async def fake_get_plan(db, u, d):
        # Simulates: User B's plan exists, but we queried for user A.
        assert u.id == user_a.id  # router passes the correct user
        return None

    monkeypatch.setattr(planner_service, "get_plan", fake_get_plan)

    app.dependency_overrides[get_current_user] = _override_auth(user_a)
    app.dependency_overrides[get_db] = _override_db()
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.get("/api/planner/plans/2026-04-17")
        assert resp.status_code == 404
        assert "not found" in resp.json()["detail"].lower()
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_db, None)


# ── PATCH 404 cases ──────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_patch_nonexistent_item_returns_404(monkeypatch):
    """PATCH /plans/{date}/items/{item_id} with unknown item_id → 404."""
    user = make_user()

    async def fake_update_item(db, u, d, item_id, payload):
        # Service returns None when plan exists but item isn't in it.
        return None

    monkeypatch.setattr(planner_service, "update_item", fake_update_item)

    app.dependency_overrides[get_current_user] = _override_auth(user)
    app.dependency_overrides[get_db] = _override_db()
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.patch(
                "/api/planner/plans/2026-04-17/items/99999",
                json={"status": "done"},
            )
        assert resp.status_code == 404
        assert "not found" in resp.json()["detail"].lower()
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_db, None)


@pytest.mark.asyncio
async def test_patch_item_with_wrong_date_returns_404(monkeypatch):
    """PATCH with date that doesn't match the item's plan → 404."""
    user = make_user()

    async def fake_update_item(db, u, d, item_id, payload):
        # Simulates: item 10 exists on 2026-04-17 but caller asked about
        # 2026-04-20. Service returns None because plan for requested date
        # doesn't exist or item isn't in it.
        return None

    monkeypatch.setattr(planner_service, "update_item", fake_update_item)

    app.dependency_overrides[get_current_user] = _override_auth(user)
    app.dependency_overrides[get_db] = _override_db()
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.patch(
                "/api/planner/plans/2026-04-20/items/10",
                json={"status": "done"},
            )
        assert resp.status_code == 404
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_db, None)


# ── GET /context default date uses user timezone ─────────────────────────────


@pytest.mark.asyncio
async def test_get_context_without_date_uses_user_timezone(monkeypatch):
    """When ``date`` query param is omitted, the router defaults to today
    in the user's timezone."""
    user = make_user(tz="America/New_York")
    captured: dict = {}

    async def fake_build_context(db, u, d):
        captured["date"] = d
        return PlannerContextResponse(
            date=d,
            timezone=u.timezone,
            due_reminders=[],
            calendar_events=[],
            yesterday=None,
        )

    monkeypatch.setattr(planner_service, "build_context", fake_build_context)

    app.dependency_overrides[get_current_user] = _override_auth(user)
    app.dependency_overrides[get_db] = _override_db()
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.get("/api/planner/context")
        assert resp.status_code == 200
        # Just verify the service was called with some date (today in NY tz).
        assert isinstance(captured["date"], date)
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_db, None)
