"""Planner API endpoints.

Thin HTTP layer over ``app.services.planner``. Mirrors the ``None``-means-404
convention used in ``reminders.py`` and ``tasks.py``. Write endpoints are
guarded by ``restrict_demo``; reads remain available to demo users.
"""
from __future__ import annotations

from datetime import date as date_type, datetime
from typing import Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, restrict_demo
from app.models.user import User
from app.schemas.planner import (
    AnalyticsResponse,
    DailyPlanCreate,
    DailyPlanResponse,
    PlanItemResponse,
    PlanItemUpdate,
    PlannerContextResponse,
)
from app.services import planner as planner_service

router = APIRouter(prefix="/api/planner", tags=["planner"])


def _today_for_user(user: User) -> date_type:
    """Return today's date in the user's stored timezone (UTC on failure)."""
    tz_name = user.timezone or "UTC"
    try:
        tz = ZoneInfo(tz_name)
    except Exception:
        tz = ZoneInfo("UTC")
    return datetime.now(tz).date()


@router.get("/context", response_model=PlannerContextResponse)
async def get_context(
    date: Optional[date_type] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Aggregate morning planning context for ``date`` (defaults to today)."""
    target = date or _today_for_user(current_user)
    return await planner_service.build_context(db, current_user, target)


@router.post("/plans", response_model=DailyPlanResponse)
async def create_or_replace_plan(
    payload: DailyPlanCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(restrict_demo),
):
    """Create or replace the plan for ``payload.date``.

    First write → ``replans_count=0``. Subsequent writes wipe items and
    increment ``replans_count``. Demo users receive 403.
    """
    return await planner_service.upsert_plan(db, current_user, payload)


@router.get("/plans/today", response_model=DailyPlanResponse)
async def read_plan_today(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Shortcut: return the current user's plan for today (user's tz) or 404.

    Declared before the ``/plans/{date}`` route so FastAPI's in-order route
    matching resolves ``today`` as a literal path segment rather than trying
    to parse it as a date (which would 422).
    """
    today = _today_for_user(current_user)
    plan = await planner_service.get_plan(db, current_user, today)
    if plan is None:
        raise HTTPException(status_code=404, detail="Plan not found")
    return plan


@router.patch(
    "/plans/today/items/{item_id}", response_model=PlanItemResponse
)
async def patch_item_today(
    item_id: int,
    payload: PlanItemUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(restrict_demo),
):
    """Shortcut: patch a plan item on today's plan (user's tz).

    Must be declared before ``/plans/{date}/items/{item_id}`` for the same
    route-matching reason as ``read_plan_today``. Demo users receive 403.
    """
    today = _today_for_user(current_user)
    item = await planner_service.update_item(
        db, current_user, today, item_id, payload
    )
    if item is None:
        raise HTTPException(status_code=404, detail="Plan item not found")
    return item


@router.get("/plans/{date}", response_model=DailyPlanResponse)
async def read_plan(
    date: date_type,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the current user's plan for ``date`` or 404."""
    plan = await planner_service.get_plan(db, current_user, date)
    if plan is None:
        raise HTTPException(status_code=404, detail="Plan not found")
    return plan


@router.patch(
    "/plans/{date}/items/{item_id}", response_model=PlanItemResponse
)
async def patch_item(
    date: date_type,
    item_id: int,
    payload: PlanItemUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(restrict_demo),
):
    """Patch a single plan item; recomputes owning plan's aggregates.

    Returns 404 when the plan doesn't exist for ``(current_user, date)`` or
    the item isn't part of it (covers cross-user PATCH attempts). Demo
    users receive 403.
    """
    item = await planner_service.update_item(
        db, current_user, date, item_id, payload
    )
    if item is None:
        raise HTTPException(status_code=404, detail="Plan item not found")
    return item


@router.get("/analytics", response_model=AnalyticsResponse)
async def get_analytics(
    from_: date_type = Query(..., alias="from"),
    to: date_type = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Aggregates for the user's plans in ``[from, to]`` (inclusive)."""
    return await planner_service.compute_analytics(db, current_user, from_, to)
