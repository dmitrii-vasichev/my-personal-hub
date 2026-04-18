"""Planner service layer — plan CRUD, context aggregation, analytics.

Pure business logic; no HTTP concerns. Router layer (Task 5) wires these
functions to FastAPI endpoints and translates ``None`` returns into 404s,
matching the convention used in ``task.py`` and ``reminders.py``.
"""

from __future__ import annotations

import logging
from datetime import date, datetime, time, timedelta
from typing import Optional

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.timezone import get_user_tz
from app.models.daily_plan import DailyPlan, PlanItem, PlanItemStatus
from app.models.reminder import Reminder, ReminderStatus
from app.models.task import Task, TaskStatus
from app.models.user import User
from app.schemas.planner import (
    AnalyticsResponse,
    ContextEvent,
    ContextReminder,
    ContextTask,
    DailyAnalyticsPoint,
    DailyPlanCreate,
    PlanItemUpdate,
    PlannerContextResponse,
    YesterdaySummary,
)

logger = logging.getLogger(__name__)

# Category key used when a plan item has no ``category`` set. Keeping a
# stable, explicit key makes category aggregates round-trip cleanly
# through JSON and analytics.
UNCATEGORIZED = "uncategorized"

# ``pending_tasks`` in the planner context is a best-effort shortlist for
# the LLM prompt, not a full backlog view. Cap it so large backlogs don't
# balloon the context payload.
PENDING_TASKS_LIMIT = 50


# ── Aggregate recomputation (pure) ───────────────────────────────────────────


def _recompute_aggregates(plan: DailyPlan) -> None:
    """Recompute derived totals on ``plan`` from its in-memory items.

    Pure: no DB calls, no I/O. Caller is responsible for flushing/committing.
    Items with ``status='done'`` but ``minutes_actual is None`` contribute 0
    to ``completed_minutes`` (safer than treating None as planned time).
    """
    items = plan.items or []

    planned_total = 0
    completed_total = 0
    categories_planned: dict[str, int] = {}
    categories_actual: dict[str, int] = {}

    for item in items:
        category = item.category or UNCATEGORIZED
        planned = item.minutes_planned or 0
        planned_total += planned
        categories_planned[category] = categories_planned.get(category, 0) + planned

        if item.status == PlanItemStatus.done:
            actual = item.minutes_actual or 0
            completed_total += actual
            if actual:
                categories_actual[category] = (
                    categories_actual.get(category, 0) + actual
                )

    plan.planned_minutes = planned_total
    plan.completed_minutes = completed_total
    plan.adherence_pct = (
        completed_total / planned_total if planned_total > 0 else 0.0
    )
    plan.categories_planned = categories_planned
    plan.categories_actual = categories_actual


# ── Plan CRUD ────────────────────────────────────────────────────────────────


async def _get_plan_row(
    db: AsyncSession, user: User, date_: date
) -> Optional[DailyPlan]:
    """Load a plan (with items) for ``(user, date_)`` or ``None``."""
    result = await db.execute(
        select(DailyPlan)
        .options(selectinload(DailyPlan.items))
        .where(DailyPlan.user_id == user.id, DailyPlan.date == date_)
    )
    return result.scalar_one_or_none()


async def _attach_task_titles(
    db: AsyncSession, items: list[PlanItem]
) -> None:
    """Populate ``item.task_title`` (Python-side attr) for each plan item.

    Performs a single batched ``SELECT`` on ``Task`` when at least one item
    has a ``linked_task_id``. Skips the query entirely when there are no
    linked tasks so unit tests with mocked sessions aren't surprised by
    extra ``db.execute`` calls.

    The attribute is set even when no task is found (``None``) so
    ``PlanItemResponse.task_title`` serializes consistently.
    """
    task_ids = {i.linked_task_id for i in items if i.linked_task_id}
    if not task_ids:
        for item in items:
            item.task_title = None
        return

    result = await db.execute(
        select(Task.id, Task.title).where(Task.id.in_(task_ids))
    )
    title_by_id = {tid: title for tid, title in result.all()}
    for item in items:
        item.task_title = (
            title_by_id.get(item.linked_task_id) if item.linked_task_id else None
        )


async def get_plan(
    db: AsyncSession, user: User, date_: date
) -> Optional[DailyPlan]:
    """Return the user's plan for ``date_`` or ``None`` if none exists.

    Cross-user access is structurally impossible because the query filters
    by ``user_id``; mismatched rows simply aren't returned. ``task_title``
    is populated on each item for the API response layer.
    """
    plan = await _get_plan_row(db, user, date_)
    if plan is not None:
        await _attach_task_titles(db, plan.items)
    return plan


async def upsert_plan(
    db: AsyncSession, user: User, payload: DailyPlanCreate
) -> DailyPlan:
    """Create or replace the plan for ``(user, payload.date)``.

    - First write: inserts a new plan row with ``replans_count=0``.
    - Subsequent writes: deletes existing items, inserts the new ones, and
      increments ``replans_count``. ``available_minutes`` is updated from
      the payload on every call.

    All changes happen in a single transaction; on exception the caller's
    session rollback undoes the delete-and-insert cleanly.
    """
    plan = await _get_plan_row(db, user, payload.date)

    if plan is None:
        plan = DailyPlan(
            user_id=user.id,
            date=payload.date,
            available_minutes=payload.available_minutes,
            replans_count=0,
        )
        db.add(plan)
        await db.flush()  # assign plan.id for item FKs
    else:
        # Replace items wholesale. ``cascade="all, delete-orphan"`` handles
        # orphan deletion when we clear the collection.
        plan.items.clear()
        plan.available_minutes = payload.available_minutes
        plan.replans_count = (plan.replans_count or 0) + 1
        await db.flush()

    for item_data in payload.items:
        plan.items.append(
            PlanItem(
                order=item_data.order,
                title=item_data.title,
                category=item_data.category,
                minutes_planned=item_data.minutes_planned,
                linked_task_id=item_data.linked_task_id,
                notes=item_data.notes,
                status=PlanItemStatus.pending,
            )
        )

    _recompute_aggregates(plan)
    await db.commit()
    await db.refresh(plan, attribute_names=["items"])
    await _attach_task_titles(db, plan.items)
    return plan


async def update_item(
    db: AsyncSession,
    user: User,
    date_: date,
    item_id: int,
    payload: PlanItemUpdate,
) -> Optional[PlanItem]:
    """Patch a single plan item and recompute the owning plan's aggregates.

    Returns ``None`` if the plan for ``(user, date_)`` doesn't exist or the
    item isn't part of it. Cross-user PATCH attempts hit the first branch.
    """
    plan = await _get_plan_row(db, user, date_)
    if plan is None:
        return None

    item = next((i for i in plan.items if i.id == item_id), None)
    if item is None:
        return None

    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(item, field, value)

    _recompute_aggregates(plan)
    await db.commit()
    await db.refresh(item)
    await _attach_task_titles(db, [item])
    return item


# ── Planner context ──────────────────────────────────────────────────────────


async def _load_calendar_events_for_date(
    db: AsyncSession, user: User, date_: date
) -> list[ContextEvent]:
    """Return local calendar events overlapping ``date_``.

    Reuses ``app.services.calendar.list_events`` which queries the local
    ``calendar_events`` mirror populated by Google sync. No outbound
    network call. Any unexpected error returns an empty list so a broken
    calendar never prevents the planner context from being built.
    """
    try:
        from app.services.calendar import list_events

        tz = await get_user_tz(db, user.id)
        start = datetime.combine(date_, time.min, tzinfo=tz)
        end = datetime.combine(date_, time.max, tzinfo=tz)
        events = await list_events(db, user, start=start, end=end)
        return [
            ContextEvent(
                id=str(e.id),
                title=e.title,
                start=e.start_time,
                end=e.end_time,
            )
            for e in events
        ]
    except Exception:  # pragma: no cover - defensive; keep context resilient
        logger.exception("Failed to load calendar events for planner context")
        return []


async def build_context(
    db: AsyncSession, user: User, date_: date
) -> PlannerContextResponse:
    """Aggregate the LLM-ready context for ``date_``.

    - ``pending_tasks``: user's tasks still in play — active statuses or
      a deadline at/before end-of-tomorrow. Ordered by deadline then
      id; capped at ``PENDING_TASKS_LIMIT``.
    - ``due_reminders``: pending reminders whose ``remind_at`` falls on
      ``date_`` (in the user's timezone) or that are flagged urgent.
    - ``calendar_events``: events overlapping ``date_`` from the local
      calendar mirror; always empty on any error.
    - ``yesterday``: summary of the previous day's plan, if one exists.
    """
    tz = await get_user_tz(db, user.id)
    tz_name = str(tz)

    # Pending tasks: active statuses OR due within tomorrow.
    active_statuses = (
        TaskStatus.backlog,
        TaskStatus.new,
        TaskStatus.in_progress,
    )
    deadline_cutoff = datetime.combine(
        date_ + timedelta(days=1), time.max, tzinfo=tz
    )
    task_result = await db.execute(
        select(Task)
        .where(
            Task.user_id == user.id,
            or_(
                Task.status.in_(active_statuses),
                and_(Task.deadline.is_not(None), Task.deadline <= deadline_cutoff),
            ),
        )
        .order_by(Task.deadline.asc().nullslast(), Task.id.asc())
        .limit(PENDING_TASKS_LIMIT)
    )
    pending_tasks = [
        ContextTask(
            id=t.id,
            title=t.title,
            priority=t.priority.value if t.priority else "medium",
            deadline=t.deadline,
            category=None,
        )
        for t in task_result.scalars().all()
    ]

    # Due reminders: pending + (fires on date_ in user tz OR urgent).
    day_start = datetime.combine(date_, time.min, tzinfo=tz)
    day_end = datetime.combine(date_, time.max, tzinfo=tz)
    reminder_result = await db.execute(
        select(Reminder)
        .where(
            Reminder.user_id == user.id,
            Reminder.status == ReminderStatus.pending,
            or_(
                and_(Reminder.remind_at >= day_start, Reminder.remind_at <= day_end),
                Reminder.is_urgent.is_(True),
            ),
        )
        .order_by(Reminder.is_urgent.desc(), Reminder.remind_at.asc())
    )
    due_reminders = [
        ContextReminder(
            id=r.id,
            title=r.title,
            remind_at=r.remind_at,
            is_urgent=bool(r.is_urgent),
            task_id=r.task_id,
        )
        for r in reminder_result.scalars().all()
    ]

    # Calendar events — graceful degradation.
    calendar_events = await _load_calendar_events_for_date(db, user, date_)

    # Yesterday summary.
    yesterday_date = date_ - timedelta(days=1)
    yesterday_plan = await _get_plan_row(db, user, yesterday_date)
    yesterday = (
        YesterdaySummary(
            adherence_pct=yesterday_plan.adherence_pct,
            completed_minutes=yesterday_plan.completed_minutes or 0,
            replans_count=yesterday_plan.replans_count or 0,
        )
        if yesterday_plan is not None
        else None
    )

    return PlannerContextResponse(
        date=date_,
        timezone=tz_name,
        pending_tasks=pending_tasks,
        due_reminders=due_reminders,
        calendar_events=calendar_events,
        yesterday=yesterday,
    )


# ── Analytics ────────────────────────────────────────────────────────────────


def _longest_streak(
    plans_by_date: dict[date, DailyPlan], threshold: float = 0.7
) -> int:
    """Longest run of calendar-consecutive days where adherence >= threshold.

    Missing days (no plan) break the streak, matching "consecutive calendar
    days" in the PRD.
    """
    if not plans_by_date:
        return 0
    dates_sorted = sorted(plans_by_date.keys())
    best = 0
    current = 0
    prev: Optional[date] = None
    for d in dates_sorted:
        plan = plans_by_date[d]
        qualifies = (
            plan.adherence_pct is not None and plan.adherence_pct >= threshold
        )
        if qualifies and prev is not None and (d - prev).days == 1:
            current += 1
        elif qualifies:
            current = 1
        else:
            current = 0
        best = max(best, current)
        prev = d
    return best


async def compute_analytics(
    db: AsyncSession, user: User, from_date: date, to_date: date
) -> AnalyticsResponse:
    """Aggregate analytics for the user's plans in ``[from_date, to_date]``.

    Empty ranges return zeros (no plans, empty series, streak 0) — never
    crashes. ``days_count`` is the calendar-day span of the window, not
    the number of plans written.
    """
    result = await db.execute(
        select(DailyPlan)
        .options(selectinload(DailyPlan.items))
        .where(
            DailyPlan.user_id == user.id,
            DailyPlan.date >= from_date,
            DailyPlan.date <= to_date,
        )
        .order_by(DailyPlan.date.asc())
    )
    plans = list(result.scalars().all())

    days_count = (to_date - from_date).days + 1

    adherences = [p.adherence_pct for p in plans if p.adherence_pct is not None]
    avg_adherence = (sum(adherences) / len(adherences)) if adherences else None

    total_planned = sum(p.planned_minutes or 0 for p in plans)
    total_completed = sum(p.completed_minutes or 0 for p in plans)
    replans_total = sum(p.replans_count or 0 for p in plans)

    # Merge categories_actual across plans.
    minutes_by_category: dict[str, int] = {}
    for plan in plans:
        for category, minutes in (plan.categories_actual or {}).items():
            minutes_by_category[category] = (
                minutes_by_category.get(category, 0) + int(minutes)
            )

    plans_by_date = {p.date: p for p in plans}
    longest_streak = _longest_streak(plans_by_date)

    daily_series = [
        DailyAnalyticsPoint(
            date=p.date,
            adherence=p.adherence_pct,
            planned=p.planned_minutes or 0,
            completed=p.completed_minutes or 0,
            replans=p.replans_count or 0,
        )
        for p in plans
    ]

    return AnalyticsResponse(
        from_date=from_date,
        to_date=to_date,
        days_count=days_count,
        avg_adherence=avg_adherence,
        total_planned_minutes=total_planned,
        total_completed_minutes=total_completed,
        minutes_by_category=minutes_by_category,
        longest_streak=longest_streak,
        replans_total=replans_total,
        daily_series=daily_series,
    )
