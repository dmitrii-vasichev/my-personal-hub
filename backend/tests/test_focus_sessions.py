"""Integration tests for the focus_sessions router (D12).

Exercises the 4 endpoints end-to-end via ``httpx.ASGITransport`` against
the live FastAPI app. Matches ``test_planner_api.py`` style — overrides
``get_current_user`` / ``get_db`` and monkeypatches the service layer, so
the DB is never actually hit.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException
from httpx import ASGITransport, AsyncClient

from app.core.database import get_db
from app.core.deps import get_current_user
from app.main import app
from app.models.focus_session import FocusSession
from app.models.user import User, UserRole
from app.schemas.focus_session import (
    FocusSessionResponse,
    FocusSessionTodayResponse,
)
from app.services import focus_session as service


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
    async def _dep():
        yield AsyncMock()

    return _dep


def _make_session(
    *,
    id_: int = 1,
    user_id: int = 1,
    task_id: int | None = None,
    plan_item_id: int | None = None,
    started_at: datetime | None = None,
    ended_at: datetime | None = None,
    planned_minutes: int = 25,
    auto_closed: bool = False,
) -> FocusSession:
    s = FocusSession()
    s.id = id_
    s.user_id = user_id
    s.task_id = task_id
    s.plan_item_id = plan_item_id
    s.started_at = started_at or datetime(2026, 4, 21, 10, 0, tzinfo=timezone.utc)
    s.ended_at = ended_at
    s.planned_minutes = planned_minutes
    s.auto_closed = auto_closed
    s.created_at = s.started_at
    return s


# ── POST /start — happy path (AC-1) ──────────────────────────────────────────


@pytest.mark.asyncio
async def test_post_start_returns_201_with_correct_shape(monkeypatch):
    """POST /start with valid payload → 201, session body populated."""
    user = make_user()
    started = datetime(2026, 4, 21, 10, 0, tzinfo=timezone.utc)
    session = _make_session(
        id_=5,
        user_id=user.id,
        task_id=42,
        plan_item_id=None,
        started_at=started,
        ended_at=None,
        planned_minutes=50,
    )

    captured: dict = {}

    async def fake_start(db, u, payload):
        captured["user_id"] = u.id
        captured["payload"] = payload
        return session

    monkeypatch.setattr(service, "start", fake_start)

    app.dependency_overrides[get_current_user] = _override_auth(user)
    app.dependency_overrides[get_db] = _override_db()
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.post(
                "/api/focus-sessions/start",
                json={"task_id": 42, "planned_minutes": 50},
            )
        assert resp.status_code == 201
        data = resp.json()
        assert data["id"] == 5
        assert data["user_id"] == user.id
        assert data["task_id"] == 42
        assert data["plan_item_id"] is None
        assert data["planned_minutes"] == 50
        assert data["ended_at"] is None
        assert data["auto_closed"] is False
        # Active session → actual_minutes is None.
        assert data["actual_minutes"] is None
        assert captured["payload"].task_id == 42
        assert captured["payload"].planned_minutes == 50
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_db, None)


# ── POST /start — conflict when active exists (AC-2) ─────────────────────────


@pytest.mark.asyncio
async def test_post_start_returns_409_when_active_session_exists(monkeypatch):
    """POST /start while another active session exists → 409."""
    user = make_user()

    async def fake_start(db, u, payload):
        raise HTTPException(
            status_code=409, detail="Active focus session already exists"
        )

    monkeypatch.setattr(service, "start", fake_start)

    app.dependency_overrides[get_current_user] = _override_auth(user)
    app.dependency_overrides[get_db] = _override_db()
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.post(
                "/api/focus-sessions/start",
                json={"planned_minutes": 25},
            )
        assert resp.status_code == 409
        assert "active" in resp.json()["detail"].lower()
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_db, None)


# ── PATCH /{id}/stop — happy path (AC-3) ─────────────────────────────────────


@pytest.mark.asyncio
async def test_patch_stop_sets_ended_at_and_actual_minutes(monkeypatch):
    """PATCH /{id}/stop on an active session → 200, ended_at set,
    actual_minutes populated."""
    user = make_user()
    started = datetime(2026, 4, 21, 10, 0, tzinfo=timezone.utc)
    ended = datetime(2026, 4, 21, 10, 20, tzinfo=timezone.utc)
    session = _make_session(
        id_=7,
        user_id=user.id,
        started_at=started,
        ended_at=ended,
        planned_minutes=25,
    )

    async def fake_stop(db, u, session_id):
        assert session_id == 7
        return session

    monkeypatch.setattr(service, "stop", fake_stop)

    app.dependency_overrides[get_current_user] = _override_auth(user)
    app.dependency_overrides[get_db] = _override_db()
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.patch("/api/focus-sessions/7/stop")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == 7
        assert data["ended_at"] is not None
        # 20 minute gap.
        assert data["actual_minutes"] == 20
        assert data["auto_closed"] is False
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_db, None)


# ── PATCH /{id}/stop — idempotent on already-stopped (AC-4) ──────────────────


@pytest.mark.asyncio
async def test_patch_stop_idempotent_when_already_ended(monkeypatch):
    """PATCH /{id}/stop on already-stopped session → 200, ended_at
    unchanged (service returns current state as-is)."""
    user = make_user()
    started = datetime(2026, 4, 21, 10, 0, tzinfo=timezone.utc)
    original_ended = datetime(2026, 4, 21, 10, 25, tzinfo=timezone.utc)
    session = _make_session(
        id_=7,
        user_id=user.id,
        started_at=started,
        ended_at=original_ended,
        planned_minutes=25,
        auto_closed=False,
    )

    call_count = {"n": 0}

    async def fake_stop(db, u, session_id):
        call_count["n"] += 1
        # Same session returned twice — no mutation between calls.
        return session

    monkeypatch.setattr(service, "stop", fake_stop)

    app.dependency_overrides[get_current_user] = _override_auth(user)
    app.dependency_overrides[get_db] = _override_db()
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp1 = await client.patch("/api/focus-sessions/7/stop")
            resp2 = await client.patch("/api/focus-sessions/7/stop")
        assert resp1.status_code == 200
        assert resp2.status_code == 200
        # Both calls report the same ended_at (idempotent).
        assert resp1.json()["ended_at"] == resp2.json()["ended_at"]
        assert call_count["n"] == 2
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_db, None)


# ── GET /active — returns active session (AC-5) ──────────────────────────────


@pytest.mark.asyncio
async def test_get_active_returns_session(monkeypatch):
    """GET /active when one is running → 200 with session body."""
    user = make_user()
    session = _make_session(
        id_=11,
        user_id=user.id,
        task_id=None,
        plan_item_id=77,
        ended_at=None,
        planned_minutes=90,
    )

    async def fake_get_active(db, u):
        return session

    monkeypatch.setattr(service, "get_active", fake_get_active)

    app.dependency_overrides[get_current_user] = _override_auth(user)
    app.dependency_overrides[get_db] = _override_db()
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.get("/api/focus-sessions/active")
        assert resp.status_code == 200
        data = resp.json()
        assert data is not None
        assert data["id"] == 11
        assert data["plan_item_id"] == 77
        assert data["ended_at"] is None
        assert data["actual_minutes"] is None
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_db, None)


# ── GET /active — returns null (AC-6) ────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_active_returns_null_when_none(monkeypatch):
    """GET /active when nothing running → 200 with null body."""
    user = make_user()

    async def fake_get_active(db, u):
        return None

    monkeypatch.setattr(service, "get_active", fake_get_active)

    app.dependency_overrides[get_current_user] = _override_auth(user)
    app.dependency_overrides[get_db] = _override_db()
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.get("/api/focus-sessions/active")
        assert resp.status_code == 200
        assert resp.json() is None
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_db, None)


# ── GET /today — aggregates total_minutes + count (AC-7) ─────────────────────


@pytest.mark.asyncio
async def test_get_today_aggregates_total_minutes_and_count(monkeypatch):
    """GET /today with mix of completed + reaped sessions → correct totals."""
    user = make_user()

    # 3 sessions: two completed (25 + 30 min) + one auto-reaped (50 min).
    responses = [
        FocusSessionResponse(
            id=1,
            user_id=user.id,
            task_id=None,
            plan_item_id=None,
            started_at=datetime(2026, 4, 21, 9, 0, tzinfo=timezone.utc),
            ended_at=datetime(2026, 4, 21, 9, 25, tzinfo=timezone.utc),
            planned_minutes=25,
            auto_closed=False,
            actual_minutes=25,
        ),
        FocusSessionResponse(
            id=2,
            user_id=user.id,
            task_id=42,
            plan_item_id=None,
            started_at=datetime(2026, 4, 21, 10, 0, tzinfo=timezone.utc),
            ended_at=datetime(2026, 4, 21, 10, 30, tzinfo=timezone.utc),
            planned_minutes=25,
            auto_closed=False,
            actual_minutes=30,
        ),
        FocusSessionResponse(
            id=3,
            user_id=user.id,
            task_id=None,
            plan_item_id=5,
            started_at=datetime(2026, 4, 21, 11, 0, tzinfo=timezone.utc),
            ended_at=datetime(2026, 4, 21, 11, 50, tzinfo=timezone.utc),
            planned_minutes=50,
            auto_closed=True,
            actual_minutes=50,
        ),
    ]
    envelope = FocusSessionTodayResponse(
        sessions=responses,
        total_minutes=25 + 30 + 50,
        count=3,
    )

    async def fake_get_today(db, u):
        assert u.id == user.id
        return envelope

    monkeypatch.setattr(service, "get_today", fake_get_today)

    app.dependency_overrides[get_current_user] = _override_auth(user)
    app.dependency_overrides[get_db] = _override_db()
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.get("/api/focus-sessions/today")
        assert resp.status_code == 200
        data = resp.json()
        assert data["count"] == 3
        assert data["total_minutes"] == 105
        assert len(data["sessions"]) == 3
        assert [s["id"] for s in data["sessions"]] == [1, 2, 3]
        # The auto-closed session is flagged.
        assert data["sessions"][2]["auto_closed"] is True
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_db, None)


# ── Demo user POST /start → 403 (AC-8) ───────────────────────────────────────


@pytest.mark.asyncio
async def test_demo_user_post_start_blocked():
    """Demo user hitting POST /start → 403."""
    demo = make_demo_user()
    app.dependency_overrides[get_current_user] = _override_auth(demo)
    app.dependency_overrides[get_db] = _override_db()
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.post(
                "/api/focus-sessions/start",
                json={"planned_minutes": 25},
            )
        assert resp.status_code == 403
        assert "demo mode" in resp.json()["detail"].lower()
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(get_db, None)
