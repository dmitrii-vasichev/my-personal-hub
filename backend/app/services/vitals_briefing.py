"""Vitals AI Daily Briefing — cross-module data assembly and LLM generation."""
from __future__ import annotations

import asyncio
import logging
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.calendar import CalendarEvent
from app.models.garmin import (
    VitalsActivity,
    VitalsBriefing,
    VitalsDailyMetric,
    VitalsSleep,
)
from app.models.job import ApplicationStatus, Job
from app.models.settings import UserSettings
from app.models.task import Task, TaskStatus
from app.services.ai import get_llm_client
from app.services.settings import get_decrypted_key

logger = logging.getLogger(__name__)

# Terminal job statuses — no further action expected
_TERMINAL_JOB_STATUSES = {
    ApplicationStatus.accepted,
    ApplicationStatus.rejected,
    ApplicationStatus.ghosted,
    ApplicationStatus.withdrawn,
}

_INTERVIEW_STATUSES = {
    ApplicationStatus.screening,
    ApplicationStatus.technical_interview,
    ApplicationStatus.final_interview,
}

_DONE_TASK_STATUSES = {TaskStatus.done, TaskStatus.cancelled}


# ── Task 1: Health data snapshot ──────────────────────────────────────────────


async def get_health_snapshot(
    db: AsyncSession, user_id: int, target_date: date
) -> dict:
    """Collect today's metrics, last night's sleep, and recent activities."""
    # Daily metrics
    result = await db.execute(
        select(VitalsDailyMetric).where(
            VitalsDailyMetric.user_id == user_id,
            VitalsDailyMetric.date == target_date,
        )
    )
    metric = result.scalar_one_or_none()

    # Sleep
    result = await db.execute(
        select(VitalsSleep).where(
            VitalsSleep.user_id == user_id,
            VitalsSleep.date == target_date,
        )
    )
    sleep = result.scalar_one_or_none()

    # Activities — last 7 days
    week_ago = target_date - timedelta(days=7)
    result = await db.execute(
        select(VitalsActivity)
        .where(
            VitalsActivity.user_id == user_id,
            VitalsActivity.start_time >= datetime.combine(week_ago, datetime.min.time(), tzinfo=timezone.utc),
            VitalsActivity.start_time <= datetime.combine(target_date + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc),
        )
        .order_by(VitalsActivity.start_time.desc())
    )
    activities = list(result.scalars().all())

    return {
        "sleep": {
            "duration_seconds": sleep.duration_seconds if sleep else None,
            "deep_seconds": sleep.deep_seconds if sleep else None,
            "light_seconds": sleep.light_seconds if sleep else None,
            "rem_seconds": sleep.rem_seconds if sleep else None,
            "awake_seconds": sleep.awake_seconds if sleep else None,
            "sleep_score": sleep.sleep_score if sleep else None,
        },
        "metrics": {
            "steps": metric.steps if metric else None,
            "resting_hr": metric.resting_hr if metric else None,
            "avg_hr": metric.avg_hr if metric else None,
            "avg_stress": metric.avg_stress if metric else None,
            "max_stress": metric.max_stress if metric else None,
            "calories_active": metric.calories_active if metric else None,
            "vo2_max": metric.vo2_max if metric else None,
        },
        "body_battery": {
            "high": metric.body_battery_high if metric else None,
            "low": metric.body_battery_low if metric else None,
        },
        "activities": [
            {
                "type": a.activity_type,
                "name": a.name,
                "start_time": a.start_time.isoformat() if a.start_time else None,
                "duration_seconds": a.duration_seconds,
                "distance_m": a.distance_m,
                "avg_hr": a.avg_hr,
                "calories": a.calories,
            }
            for a in activities
        ],
    }


# ── Task 2: Tasks data snapshot ──────────────────────────────────────────────


async def get_tasks_snapshot(
    db: AsyncSession, user_id: int, target_date: date
) -> dict:
    """Collect active tasks count, overdue count, today's deadlines, completion rate."""
    now = datetime.combine(target_date, datetime.min.time(), tzinfo=timezone.utc)
    day_end = now + timedelta(days=1)

    # Active tasks (not done/cancelled)
    result = await db.execute(
        select(func.count(Task.id)).where(
            Task.user_id == user_id,
            Task.status.notin_([s.value for s in _DONE_TASK_STATUSES]),
        )
    )
    active_count = result.scalar() or 0

    # Overdue tasks
    result = await db.execute(
        select(func.count(Task.id)).where(
            Task.user_id == user_id,
            Task.status.notin_([s.value for s in _DONE_TASK_STATUSES]),
            Task.deadline.isnot(None),
            Task.deadline < now,
        )
    )
    overdue_count = result.scalar() or 0

    # Today's deadlines
    result = await db.execute(
        select(Task.title, Task.priority).where(
            Task.user_id == user_id,
            Task.status.notin_([s.value for s in _DONE_TASK_STATUSES]),
            Task.deadline.isnot(None),
            Task.deadline >= now,
            Task.deadline < day_end,
        )
    )
    todays_deadlines = [
        {"title": row.title, "priority": row.priority.value if row.priority else "medium"}
        for row in result.all()
    ]

    # 7-day completion rate
    week_ago = now - timedelta(days=7)
    result = await db.execute(
        select(func.count(Task.id)).where(
            Task.user_id == user_id,
            Task.status == TaskStatus.done.value,
            Task.completed_at.isnot(None),
            Task.completed_at >= week_ago,
        )
    )
    completed_7d = result.scalar() or 0

    result = await db.execute(
        select(func.count(Task.id)).where(
            Task.user_id == user_id,
            Task.created_at >= week_ago,
        )
    )
    created_7d = result.scalar() or 0
    completion_rate = round(completed_7d / created_7d * 100) if created_7d > 0 else 0

    return {
        "active_count": active_count,
        "overdue_count": overdue_count,
        "todays_deadlines": todays_deadlines,
        "completion_rate_7d": completion_rate,
    }


# ── Task 3: Calendar data snapshot ───────────────────────────────────────────

_INTERVIEW_KEYWORDS = {"interview", "собеседование", "интервью"}


async def get_calendar_snapshot(
    db: AsyncSession, user_id: int, target_date: date
) -> dict:
    """Collect today's events, classify meetings/interviews, compute free blocks."""
    day_start = datetime.combine(target_date, datetime.min.time(), tzinfo=timezone.utc)
    day_end = day_start + timedelta(days=1)

    result = await db.execute(
        select(CalendarEvent)
        .where(
            CalendarEvent.user_id == user_id,
            CalendarEvent.start_time >= day_start,
            CalendarEvent.start_time < day_end,
        )
        .order_by(CalendarEvent.start_time)
    )
    events = list(result.scalars().all())

    interviews = []
    events_data = []
    for ev in events:
        title_lower = (ev.title or "").lower()
        is_interview = any(kw in title_lower for kw in _INTERVIEW_KEYWORDS)
        event_dict = {
            "title": ev.title,
            "start_time": ev.start_time.isoformat() if ev.start_time else None,
            "end_time": ev.end_time.isoformat() if ev.end_time else None,
            "all_day": ev.all_day,
        }
        events_data.append(event_dict)
        if is_interview:
            interviews.append(event_dict)

    # Compute free blocks (gaps > 30 min between non-all-day events)
    timed_events = [e for e in events if not e.all_day]
    free_blocks = []
    for i in range(len(timed_events) - 1):
        end_current = timed_events[i].end_time
        start_next = timed_events[i + 1].start_time
        if end_current and start_next:
            gap = (start_next - end_current).total_seconds()
            if gap >= 1800:  # 30 minutes
                free_blocks.append({
                    "start": end_current.isoformat(),
                    "end": start_next.isoformat(),
                    "duration_minutes": int(gap / 60),
                })

    return {
        "events": events_data,
        "meetings_count": len([e for e in events if not e.all_day]),
        "interviews": interviews,
        "free_blocks": free_blocks,
    }


# ── Task 4: Jobs data snapshot ───────────────────────────────────────────────


async def get_jobs_snapshot(
    db: AsyncSession, user_id: int, target_date: date
) -> dict:
    """Collect upcoming interviews, active application count, pending actions."""
    three_days = target_date + timedelta(days=3)

    # Upcoming interviews (interview-stage jobs with next_action_date in next 3 days)
    result = await db.execute(
        select(Job).where(
            Job.user_id == user_id,
            Job.status.in_([s.value for s in _INTERVIEW_STATUSES]),
            Job.next_action_date.isnot(None),
            Job.next_action_date <= three_days,
        )
    )
    interview_jobs = list(result.scalars().all())
    upcoming_interviews = [
        {
            "company": j.company,
            "title": j.title,
            "date": j.next_action_date.isoformat() if j.next_action_date else None,
            "next_action": j.next_action,
        }
        for j in interview_jobs
    ]

    # Active applications count
    result = await db.execute(
        select(func.count(Job.id)).where(
            Job.user_id == user_id,
            Job.status.isnot(None),
            Job.status.notin_([s.value for s in _TERMINAL_JOB_STATUSES]),
        )
    )
    active_count = result.scalar() or 0

    # Pending actions
    result = await db.execute(
        select(Job)
        .where(
            Job.user_id == user_id,
            Job.next_action.isnot(None),
            Job.next_action_date.isnot(None),
            Job.status.notin_([s.value for s in _TERMINAL_JOB_STATUSES]),
        )
        .order_by(Job.next_action_date)
    )
    pending_jobs = list(result.scalars().all())
    pending_actions = [
        {
            "company": j.company,
            "title": j.title,
            "next_action": j.next_action,
            "date": j.next_action_date.isoformat() if j.next_action_date else None,
        }
        for j in pending_jobs
    ]

    return {
        "upcoming_interviews": upcoming_interviews,
        "active_count": active_count,
        "pending_actions": pending_actions,
    }


# ── Task 5: Briefing prompt assembly ─────────────────────────────────────────

_SYSTEM_PROMPT = """You are a personal wellness and productivity advisor. \
Analyze the provided data and generate a concise daily briefing in markdown format.

Your briefing must contain exactly 4 sections:
1. **Health Status** — brief assessment of physical readiness based on sleep, stress, body battery, and recent activity
2. **Day Forecast** — what the day looks like workload-wise (meetings, deadlines, interviews)
3. **Recommendations** — optimal timing for deep work, breaks, preparation; actionable advice
4. **Notable Patterns** — any correlations worth mentioning (e.g., poor sleep → lower body battery → suggest lighter workload)

Keep the briefing concise (under 500 words). Be specific and actionable, not generic. \
If data for a section is missing, briefly note it and move on — do not fabricate data."""


def _format_seconds(seconds: int | None) -> str:
    """Format seconds as 'Xh Ym'."""
    if not seconds:
        return "N/A"
    h = seconds // 3600
    m = (seconds % 3600) // 60
    return f"{h}h {m}m"


def _build_briefing_prompt(
    health: dict | None,
    tasks: dict | None,
    calendar: dict | None,
    jobs: dict | None,
) -> str:
    """Build structured user prompt from snapshot data."""
    sections: list[str] = []

    # Health section
    if health:
        sleep = health.get("sleep", {})
        metrics = health.get("metrics", {})
        bb = health.get("body_battery", {})
        activities = health.get("activities", [])

        lines = ["## Health Data (Garmin)"]
        if any(v is not None for v in sleep.values()):
            lines.append(
                f"- Sleep: {_format_seconds(sleep.get('duration_seconds'))}, "
                f"score {sleep.get('sleep_score', 'N/A')}/100, "
                f"deep {_format_seconds(sleep.get('deep_seconds'))}, "
                f"REM {_format_seconds(sleep.get('rem_seconds'))}"
            )
        if bb.get("high") is not None or bb.get("low") is not None:
            lines.append(f"- Body Battery: high {bb.get('high', 'N/A')}, low {bb.get('low', 'N/A')}")
        if metrics.get("resting_hr") is not None:
            lines.append(f"- Resting HR: {metrics['resting_hr']} bpm")
        if metrics.get("avg_stress") is not None:
            lines.append(
                f"- Stress: avg {metrics['avg_stress']}, max {metrics.get('max_stress', 'N/A')}"
            )
        if activities:
            act_summary = "; ".join(
                f"{a['name'] or a['type']} ({_format_seconds(a.get('duration_seconds'))})"
                for a in activities[:5]
            )
            lines.append(f"- Recent activities: {act_summary}")

        if len(lines) > 1:
            sections.append("\n".join(lines))

    # Calendar section
    if calendar:
        events = calendar.get("events", [])
        interviews = calendar.get("interviews", [])
        free_blocks = calendar.get("free_blocks", [])

        lines = ["## Today's Schedule"]
        lines.append(f"- {calendar.get('meetings_count', 0)} meetings/events")
        if interviews:
            interview_names = ", ".join(i["title"] for i in interviews)
            lines.append(f"- Interviews: {interview_names}")
        if free_blocks:
            blocks_str = "; ".join(
                f"{b['start'][-13:-6]}–{b['end'][-13:-6]} ({b['duration_minutes']}m)"
                for b in free_blocks[:5]
            )
            lines.append(f"- Free blocks: {blocks_str}")
        if events:
            for ev in events[:8]:
                time_str = ev["start_time"][-13:-6] if ev["start_time"] else "all-day"
                lines.append(f"  - {time_str}: {ev['title']}")

        if len(lines) > 1:
            sections.append("\n".join(lines))

    # Tasks section
    if tasks:
        lines = ["## Workload"]
        lines.append(
            f"- Active tasks: {tasks.get('active_count', 0)}, "
            f"overdue: {tasks.get('overdue_count', 0)}"
        )
        lines.append(f"- Completion rate (7d): {tasks.get('completion_rate_7d', 0)}%")
        deadlines = tasks.get("todays_deadlines", [])
        if deadlines:
            for d in deadlines[:5]:
                lines.append(f"  - Deadline: {d['title']} (priority: {d['priority']})")

        if len(lines) > 1:
            sections.append("\n".join(lines))

    # Jobs section
    if jobs:
        upcoming = jobs.get("upcoming_interviews", [])
        pending = jobs.get("pending_actions", [])

        lines = ["## Job Hunt"]
        lines.append(f"- Active applications: {jobs.get('active_count', 0)}")
        if upcoming:
            for i in upcoming[:3]:
                lines.append(f"  - Interview: {i['company']} — {i['title']} on {i['date']}")
        if pending:
            for p in pending[:3]:
                lines.append(f"  - Action: {p['next_action']} for {p['company']} by {p['date']}")

        if len(lines) > 1:
            sections.append("\n".join(lines))

    if not sections:
        return "No data available for today. Please provide a brief note that data is not yet available."

    prompt = "\n\n".join(sections)
    prompt += (
        "\n\nProvide:\n"
        "1. **Health Status** — brief assessment of physical readiness\n"
        "2. **Day Forecast** — what the day looks like workload-wise\n"
        "3. **Recommendations** — optimal timing for deep work, breaks, prep\n"
        "4. **Notable Patterns** — any correlations worth mentioning"
    )
    return prompt


# ── Task 6: Briefing generation service ──────────────────────────────────────


async def _get_llm_for_user(
    db: AsyncSession, user_id: int
) -> Optional[tuple]:
    """Return (llm_client, provider) or None if not configured."""
    result = await db.execute(
        select(UserSettings).where(UserSettings.user_id == user_id)
    )
    settings = result.scalar_one_or_none()
    if not settings or not settings.llm_provider:
        return None

    provider = settings.llm_provider
    api_key = get_decrypted_key(settings, f"api_key_{provider}")
    if not api_key:
        return None

    return get_llm_client(provider, api_key), provider


async def generate_vitals_briefing(
    db: AsyncSession, user_id: int, target_date: date | None = None
) -> Optional[VitalsBriefing]:
    """Orchestrate data collection, prompt assembly, LLM call, and save result."""
    if target_date is None:
        target_date = date.today()

    # Get LLM client
    llm_result = await _get_llm_for_user(db, user_id)
    if llm_result is None:
        logger.warning("No LLM provider configured for user %s", user_id)
        return None
    llm, provider = llm_result

    # Collect all snapshots in parallel
    health, tasks, calendar, jobs = await asyncio.gather(
        get_health_snapshot(db, user_id, target_date),
        get_tasks_snapshot(db, user_id, target_date),
        get_calendar_snapshot(db, user_id, target_date),
        get_jobs_snapshot(db, user_id, target_date),
    )

    # Build prompt
    user_prompt = _build_briefing_prompt(health, tasks, calendar, jobs)

    # Call LLM
    try:
        content = await llm.generate(_SYSTEM_PROMPT, user_prompt)
    except Exception as e:
        logger.error("LLM generation failed for user %s: %s", user_id, e)
        return None

    # Upsert briefing
    result = await db.execute(
        select(VitalsBriefing).where(
            VitalsBriefing.user_id == user_id,
            VitalsBriefing.date == target_date,
        )
    )
    briefing = result.scalar_one_or_none()

    if briefing is None:
        briefing = VitalsBriefing(
            user_id=user_id,
            date=target_date,
            content=content,
            health_data_json=health,
            tasks_data_json=tasks,
            calendar_data_json=calendar,
            jobs_data_json=jobs,
            generated_at=datetime.now(timezone.utc),
        )
        db.add(briefing)
    else:
        briefing.content = content
        briefing.health_data_json = health
        briefing.tasks_data_json = tasks
        briefing.calendar_data_json = calendar
        briefing.jobs_data_json = jobs
        briefing.generated_at = datetime.now(timezone.utc)

    await db.flush()
    return briefing


# ── Task 8: Auto-generation after sync ───────────────────────────────────────


async def maybe_auto_generate_briefing(
    db: AsyncSession, user_id: int
) -> None:
    """Generate briefing after sync if conditions are met."""
    today = date.today()

    # Check if briefing already exists for today
    result = await db.execute(
        select(VitalsBriefing).where(
            VitalsBriefing.user_id == user_id,
            VitalsBriefing.date == today,
        )
    )
    if result.scalar_one_or_none() is not None:
        logger.debug("Briefing already exists for user %s today, skipping", user_id)
        return

    # Check if health data exists
    result = await db.execute(
        select(VitalsDailyMetric).where(
            VitalsDailyMetric.user_id == user_id,
            VitalsDailyMetric.date == today,
        )
    )
    if result.scalar_one_or_none() is None:
        logger.debug("No health data for user %s today, skipping briefing", user_id)
        return

    # Check if LLM is configured
    llm_result = await _get_llm_for_user(db, user_id)
    if llm_result is None:
        logger.debug("No LLM configured for user %s, skipping briefing", user_id)
        return

    try:
        briefing = await generate_vitals_briefing(db, user_id, today)
        if briefing:
            logger.info("Auto-generated briefing for user %s", user_id)
        else:
            logger.warning("Auto-generation returned None for user %s", user_id)
    except Exception as e:
        logger.error("Auto-generation failed for user %s: %s", user_id, e)


# ── Task 9: Briefing cleanup ─────────────────────────────────────────────────


async def cleanup_old_briefings(db: AsyncSession) -> int:
    """Delete briefings older than 90 days. Returns count of deleted records."""
    cutoff = date.today() - timedelta(days=90)
    result = await db.execute(
        delete(VitalsBriefing).where(VitalsBriefing.date < cutoff)
    )
    count = result.rowcount
    if count:
        logger.info("Cleaned up %d old briefings (before %s)", count, cutoff)
    return count


async def run_briefing_cleanup() -> None:
    """Background cleanup job for APScheduler."""
    from app.core.database import async_session_factory

    async with async_session_factory() as db:
        try:
            await cleanup_old_briefings(db)
            await db.commit()
        except Exception as e:
            logger.error("Briefing cleanup failed: %s", e)
