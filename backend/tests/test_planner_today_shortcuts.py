"""Integration tests for the planner ``/plans/today`` shortcut endpoints
(Phase 2, Task A6).

Verifies that:

* ``GET /api/planner/plans/today`` returns the user's plan for today in
  their timezone, or 404 when no plan exists.
* ``PATCH /api/planner/plans/today/items/{id}`` updates the item, returns
  the new row, and that a follow-up GET reflects the recomputed aggregates.
* The shortcuts are scoped per-user (cross-user PATCH → 404).
* Unknown item ids → 404.

Follows the same fixture / dependency-override / monkeypatch pattern as
``test_planner_api.py``.
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


def _override_auth(user: User):
    async def _dep():
        return user

    return _dep


def _override_db():
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
    item.notes = None
    item.created_at = datetime(2026, 4, 17, 8, 0, tzinfo=timezone.utc)
    item.updated_at = datetime(2026, 4, 17, 8, 0, tzinfo=timezone.utc)
    return item


def _make_plan(
    *,
    plan_id: int = 1,
    user_id: int = 1,
    date_: date | None = None,
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
    p.date = date_ or date(2026, 4, 17)
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


# ── GET /plans/today ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_plan_today_returns_404_when_no_plan(monkeypatch):
    """GET /plans/today with no plan for today → 404."""
    user = make_user()

    async def fake_get_plan(db, u, d):
        assert u.id == user.id
        # Router passes "today" in the user's tz; we don't assert the exact
        # value since it depends on wall clock.
        assert isinstance(d, date)
        return None

    monkeypatch.setattr(planner_service, "get_plan", fake_get_plan)

    app.dependency_overrides[get_current_user] = _override_auth(user)
    app.dependency_overrides[get_db] = _override_db()
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.get("/api/planner/plans/today")
        assert resp.status_code == 404
        assert "not found" in resp.json()["detail"].lower()
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_db, None)


@pytest.mark.asyncio
async def test_post_plan_then_get_today_returns_200_with_payload(monkeypatch):
    """After POST /plans, GET /plans/today returns the same plan.

    The service layer is monkeypatched per-call: ``upsert_plan`` captures the
    payload, ``get_plan`` returns whatever the most recent upsert produced.
    Exercises the end-to-end flow the Planner skill actually uses.
    """
    user = make_user()
    state: dict = {"plan": None}

    async def fake_upsert(db, u, payload):
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
        plan = _make_plan(
            plan_id=1,
            user_id=u.id,
            date_=payload.date,
            available_minutes=payload.available_minutes,
            planned_minutes=sum(p.minutes_planned for p in payload.items),
            items=items,
        )
        state["plan"] = plan
        return plan

    async def fake_get_plan(db, u, d):
        # "today" is inferred by the router; just return whatever was stored.
        plan = state["plan"]
        if plan and plan.user_id == u.id:
            return plan
        return None

    monkeypatch.setattr(planner_service, "upsert_plan", fake_upsert)
    monkeypatch.setattr(planner_service, "get_plan", fake_get_plan)

    app.dependency_overrides[get_current_user] = _override_auth(user)
    app.dependency_overrides[get_db] = _override_db()
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            # Create today's plan. Use today's actual date so the shortcut's
            # tz-derived "today" lines up with the stored plan's date.
            today_iso = datetime.now(timezone.utc).date().isoformat()
            post_resp = await client.post(
                "/api/planner/plans",
                json={
                    "date": today_iso,
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
                            "minutes_planned": 30,
                        },
                    ],
                },
            )
            assert post_resp.status_code == 200

            # GET /plans/today should hit the same stored plan.
            today_resp = await client.get("/api/planner/plans/today")
        assert today_resp.status_code == 200
        data = today_resp.json()
        assert data["id"] == 1
        assert data["available_minutes"] == 480
        assert [i["title"] for i in data["items"]] == ["Deep work", "Email"]
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_db, None)


# ── PATCH /plans/today/items/{id} ────────────────────────────────────────────


@pytest.mark.asyncio
async def test_patch_today_item_updates_and_aggregates_reflect_change(monkeypatch):
    """PATCH /plans/today/items/{id} with status=done + minutes_actual:
    response echoes the new values and a follow-up GET reflects updated
    aggregates (completed_minutes, adherence_pct, categories_actual).
    """
    user = make_user()

    patched_item = _make_plan_item(
        id_=10,
        plan_id=1,
        order=0,
        title="Deep work",
        category="deep_work",
        minutes_planned=120,
        minutes_actual=90,
        status=PlanItemStatus.done,
    )

    updated_plan = _make_plan(
        plan_id=1,
        user_id=user.id,
        planned_minutes=120,
        completed_minutes=90,
        adherence_pct=90 / 120,
        categories_planned={"deep_work": 120},
        categories_actual={"deep_work": 90},
        items=[patched_item],
    )

    captured: dict = {}

    async def fake_update_item(db, u, d, item_id, payload):
        captured["date"] = d
        captured["item_id"] = item_id
        captured["payload"] = payload
        assert u.id == user.id
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
                "/api/planner/plans/today/items/10",
                json={"status": "done", "minutes_actual": 90},
            )
            assert patch_resp.status_code == 200
            item_data = patch_resp.json()
            assert item_data["id"] == 10
            assert item_data["status"] == "done"
            assert item_data["minutes_actual"] == 90

            # Follow-up GET sees the recomputed aggregates.
            get_resp = await client.get("/api/planner/plans/today")
        assert get_resp.status_code == 200
        plan_data = get_resp.json()
        assert plan_data["completed_minutes"] == 90
        assert plan_data["adherence_pct"] == pytest.approx(90 / 120)
        assert plan_data["categories_actual"] == {"deep_work": 90}

        # The router resolved "today" into an actual date and forwarded the
        # payload to the service untouched.
        assert isinstance(captured["date"], date)
        assert captured["item_id"] == 10
        assert captured["payload"].status == PlanItemStatus.done
        assert captured["payload"].minutes_actual == 90
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_db, None)


@pytest.mark.asyncio
async def test_patch_today_unknown_item_returns_404(monkeypatch):
    """PATCH /plans/today/items/{bogus_id} when service returns None → 404."""
    user = make_user()

    async def fake_update_item(db, u, d, item_id, payload):
        # No plan today, or the item id isn't on it.
        return None

    monkeypatch.setattr(planner_service, "update_item", fake_update_item)

    app.dependency_overrides[get_current_user] = _override_auth(user)
    app.dependency_overrides[get_db] = _override_db()
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.patch(
                "/api/planner/plans/today/items/99999",
                json={"status": "done"},
            )
        assert resp.status_code == 404
        assert "not found" in resp.json()["detail"].lower()
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_db, None)


# ── Cross-user scoping ──────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_user_b_cannot_patch_user_as_today_item(monkeypatch):
    """User B PATCHes an item that only exists on User A's plan → 404.

    ``update_item`` filters by ``user_id`` when loading the plan, so the
    service returns ``None`` for user B. The router translates that to 404
    — users never see 403 for items they don't own, to avoid leaking the
    existence of other users' items.
    """
    user_b = make_user(user_id=2)

    seen: dict = {}

    async def fake_update_item(db, u, d, item_id, payload):
        # Service scopes by u.id; an item belonging to user_a would be
        # invisible here. Simulate that by returning None.
        seen["u_id"] = u.id
        return None

    monkeypatch.setattr(planner_service, "update_item", fake_update_item)

    app.dependency_overrides[get_current_user] = _override_auth(user_b)
    app.dependency_overrides[get_db] = _override_db()
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.patch(
                "/api/planner/plans/today/items/10",
                json={"status": "done"},
            )
        assert resp.status_code == 404
        # The router forwarded the calling user's id — not user A's.
        assert seen["u_id"] == user_b.id
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_db, None)
