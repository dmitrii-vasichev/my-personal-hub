"""Focus session service layer — start/stop/active/today + lazy reaper (D12).

Pure business logic; no HTTP concerns. The router layer translates service
returns into HTTP responses. All read endpoints run ``_reap_stale_sessions``
first so expired active sessions auto-close before we query, replacing a
background cron with a lazy sweep on access.

Key invariants:
- Only one active session per user at any time — enforced in ``start`` by
  an explicit pre-insert check after reaping.
- ``plan_items.minutes_actual`` is ``NULLABLE`` on the DB; increments use
  ``func.coalesce(PlanItem.minutes_actual, 0) + minutes`` to avoid NULL
  arithmetic blowing up on first increment.
- Stop always caps actual minutes at ``planned_minutes`` before adding
  them to a linked plan item so overruns don't inflate plan progress.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, time, timezone
from typing import Optional
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.daily_plan import DailyPlan, PlanItem
from app.models.focus_session import FocusSession
from app.models.task import Task
from app.models.user import User
from app.schemas.focus_session import (
    FocusSessionResponse,
    FocusSessionStart,
    FocusSessionTodayResponse,
)

logger = logging.getLogger(__name__)


# ── Helpers ──────────────────────────────────────────────────────────────────


def _now() -> datetime:
    """Current UTC timestamp (timezone-aware)."""
    return datetime.now(timezone.utc)


def _actual_minutes(session: FocusSession) -> Optional[int]:
    """Whole minutes between ``started_at`` and ``ended_at`` (clamped ≥ 0).

    Returns ``None`` if the session is still active. Uses integer floor
    division of the total-seconds delta so a 59-second run reads as 0 min.
    """
    if session.ended_at is None:
        return None
    delta = (session.ended_at - session.started_at).total_seconds()
    if delta < 0:
        return 0
    return int(delta // 60)


async def _increment_plan_item(
    db: AsyncSession, plan_item_id: int, minutes: int
) -> None:
    """Add ``minutes`` to ``plan_items.minutes_actual`` (coalesced from NULL).

    The column is ``NULLABLE`` (:class:`PlanItem` defines it as
    ``Optional[int]``) so a raw ``col + minutes`` would yield ``NULL``.
    ``func.coalesce(col, 0) + minutes`` keeps the increment safe.
    """
    if minutes <= 0:
        return
    await db.execute(
        update(PlanItem)
        .where(PlanItem.id == plan_item_id)
        .values(
            minutes_actual=func.coalesce(PlanItem.minutes_actual, 0) + minutes
        )
    )


async def _reap_stale_sessions(db: AsyncSession, user: User) -> bool:
    """Auto-close any of the user's active sessions whose timer has expired.

    For each active (``ended_at IS NULL``) session whose
    ``started_at + planned_minutes`` is in the past:
    - set ``ended_at = started_at + planned_minutes``
    - set ``auto_closed = True``
    - if linked to a plan item, add the full planned minutes to that
      item's ``minutes_actual``.

    Returns ``True`` when at least one session was reaped (caller commits).
    Caller is responsible for committing; we flush so subsequent queries in
    the same transaction see the updates.
    """
    result = await db.execute(
        select(FocusSession).where(
            FocusSession.user_id == user.id,
            FocusSession.ended_at.is_(None),
        )
    )
    active = result.scalars().all()
    now = _now()
    reaped = 0
    for session in active:
        deadline = session.started_at + timedelta(minutes=session.planned_minutes)
        if deadline <= now:
            session.ended_at = deadline
            session.auto_closed = True
            if session.plan_item_id is not None:
                await _increment_plan_item(
                    db, session.plan_item_id, session.planned_minutes
                )
            reaped += 1
    if reaped:
        await db.flush()
        logger.info(
            "Reaped %d stale focus session(s) for user_id=%s", reaped, user.id
        )
    return reaped > 0


def _to_response(session: FocusSession) -> FocusSessionResponse:
    """Build the API response envelope from a model instance."""
    data = {
        "id": session.id,
        "user_id": session.user_id,
        "task_id": session.task_id,
        "plan_item_id": session.plan_item_id,
        "started_at": session.started_at,
        "ended_at": session.ended_at,
        "planned_minutes": session.planned_minutes,
        "auto_closed": session.auto_closed,
        "actual_minutes": _actual_minutes(session),
        # MVP: titles left as None; frontend resolves via its own task/plan
        # caches. Add a best-effort lookup here later if needed.
        "task_title": None,
        "plan_item_title": None,
    }
    return FocusSessionResponse.model_validate(data)


# ── Public service surface ──────────────────────────────────────────────────


async def start(
    db: AsyncSession, user: User, payload: FocusSessionStart
) -> FocusSession:
    """Start a new focus session for ``user``.

    Reaps stale sessions first so a just-expired timer doesn't falsely
    block the new one. Then:
    - 409 if another active session still remains.
    - 404 if ``task_id`` is set and doesn't belong to ``user``.
    - 404 if ``plan_item_id`` is set and its plan doesn't belong to
      ``user`` (join with ``daily_plans`` — ``PlanItem.plan`` is
      ``lazy='noload'`` so ``.has(...)`` wouldn't trigger the join).
    Otherwise inserts + commits and returns the hydrated model.
    """
    await _reap_stale_sessions(db, user)

    existing = await db.execute(
        select(FocusSession).where(
            FocusSession.user_id == user.id,
            FocusSession.ended_at.is_(None),
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=409, detail="Active focus session already exists"
        )

    if payload.task_id is not None:
        task_row = await db.execute(
            select(Task.id).where(
                Task.id == payload.task_id, Task.user_id == user.id
            )
        )
        if task_row.scalar_one_or_none() is None:
            raise HTTPException(status_code=404, detail="Task not found")

    if payload.plan_item_id is not None:
        pi_row = await db.execute(
            select(PlanItem.id)
            .join(DailyPlan, DailyPlan.id == PlanItem.plan_id)
            .where(
                PlanItem.id == payload.plan_item_id,
                DailyPlan.user_id == user.id,
            )
        )
        if pi_row.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=404, detail="Plan item not found"
            )

    session = FocusSession(
        user_id=user.id,
        task_id=payload.task_id,
        plan_item_id=payload.plan_item_id,
        started_at=_now(),
        planned_minutes=payload.planned_minutes,
        auto_closed=False,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


async def stop(
    db: AsyncSession, user: User, session_id: int
) -> FocusSession:
    """Stop an active session, or return it unchanged if already stopped.

    Reaps stale sessions first (so a newly expired session stops
    idempotently). 404 if the session doesn't belong to the user. On a
    real stop: ``ended_at = now()``; the capped actual minutes (min of
    elapsed and planned) are added to any linked plan item's
    ``minutes_actual``.
    """
    await _reap_stale_sessions(db, user)

    result = await db.execute(
        select(FocusSession).where(
            FocusSession.id == session_id,
            FocusSession.user_id == user.id,
        )
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(
            status_code=404, detail="Focus session not found"
        )

    # Idempotent stop: if already ended (manual stop or reaper), return
    # the current state without touching ended_at or re-incrementing.
    if session.ended_at is not None:
        # If the reaper ran during this call, it flushed but didn't commit
        # — make sure those updates persist.
        await db.commit()
        await db.refresh(session)
        return session

    session.ended_at = _now()
    capped = min(_actual_minutes(session) or 0, session.planned_minutes)
    if session.plan_item_id is not None and capped > 0:
        await _increment_plan_item(db, session.plan_item_id, capped)
    await db.commit()
    await db.refresh(session)
    return session


async def get_active(
    db: AsyncSession, user: User
) -> Optional[FocusSession]:
    """Return the user's currently-active session (or ``None``).

    The reaper runs first; if it closed anything we commit before
    querying so the caller sees the post-reap state.
    """
    reaped = await _reap_stale_sessions(db, user)
    if reaped:
        await db.commit()

    result = await db.execute(
        select(FocusSession).where(
            FocusSession.user_id == user.id,
            FocusSession.ended_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def get_today(
    db: AsyncSession, user: User
) -> FocusSessionTodayResponse:
    """Return today's focus sessions + total minutes (user's timezone).

    "Today" is derived from ``user.timezone`` (fallback UTC) and the
    filter is translated to UTC for comparison with the stored
    timezone-aware ``started_at``. ``total_minutes`` sums
    ``_actual_minutes`` across completed sessions (active ones add 0).
    """
    reaped = await _reap_stale_sessions(db, user)
    if reaped:
        await db.commit()

    tz_name = user.timezone or "UTC"
    try:
        tz = ZoneInfo(tz_name)
    except Exception:
        tz = ZoneInfo("UTC")
    today = datetime.now(tz).date()
    day_start = datetime.combine(today, time.min, tzinfo=tz)
    day_end = day_start + timedelta(days=1)
    # Convert to UTC for the DB filter (stored column is timezone-aware).
    day_start_utc = day_start.astimezone(timezone.utc)
    day_end_utc = day_end.astimezone(timezone.utc)

    result = await db.execute(
        select(FocusSession)
        .where(
            FocusSession.user_id == user.id,
            FocusSession.started_at >= day_start_utc,
            FocusSession.started_at < day_end_utc,
        )
        .order_by(FocusSession.started_at.asc())
    )
    sessions = list(result.scalars().all())
    responses = [_to_response(s) for s in sessions]
    total = sum((r.actual_minutes or 0) for r in responses)
    return FocusSessionTodayResponse(
        sessions=responses, total_minutes=total, count=len(responses)
    )
