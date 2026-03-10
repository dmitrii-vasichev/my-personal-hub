"""
Dashboard summary service — aggregates metrics across all modules.
"""
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.calendar import CalendarEvent
from app.models.job import ApplicationStatus, Job
from app.models.task import Task, TaskStatus
from app.models.user import User

# Terminal statuses that are not "active"
_INACTIVE_APP_STATUSES = {
    ApplicationStatus.accepted,
    ApplicationStatus.rejected,
    ApplicationStatus.ghosted,
    ApplicationStatus.withdrawn,
}

_INTERVIEW_STATUSES = {
    ApplicationStatus.technical_interview,
    ApplicationStatus.final_interview,
}


async def get_summary(db: AsyncSession, user: User) -> dict:
    """Aggregated dashboard metrics across tasks, jobs, and calendar."""
    now = datetime.now(tz=timezone.utc)

    # ── Tasks ──────────────────────────────────────────────────────────────────
    task_result = await db.execute(
        select(Task.status, func.count(Task.id).label("count"))
        .where(Task.user_id == user.id)
        .group_by(Task.status)
    )
    task_counts: dict[str, int] = {str(r.status.value): r.count for r in task_result.all()}

    total_tasks = sum(task_counts.values())
    done_tasks = task_counts.get(TaskStatus.done.value, 0)
    active_tasks = sum(
        v for k, v in task_counts.items()
        if k not in (TaskStatus.done.value, TaskStatus.cancelled.value)
    )
    completion_rate = round(done_tasks / total_tasks * 100, 1) if total_tasks > 0 else 0.0

    overdue_count_result = await db.execute(
        select(func.count(Task.id))
        .where(
            and_(
                Task.user_id == user.id,
                Task.deadline < now,
                Task.status.notin_([TaskStatus.done, TaskStatus.cancelled]),
            )
        )
    )
    overdue_count = overdue_count_result.scalar_one()

    # ── Job hunt ───────────────────────────────────────────────────────────────
    job_result = await db.execute(
        select(Job.status, func.count(Job.id).label("count"))
        .where(Job.user_id == user.id, Job.status.isnot(None))
        .group_by(Job.status)
    )
    job_counts: dict[str, int] = {str(r.status.value): r.count for r in job_result.all()}

    active_applications = sum(
        v for k, v in job_counts.items()
        if k not in {s.value for s in _INACTIVE_APP_STATUSES}
    )
    upcoming_interviews = sum(
        job_counts.get(s.value, 0) for s in _INTERVIEW_STATUSES
    )

    # ── Calendar ───────────────────────────────────────────────────────────────
    week_end = now + timedelta(days=7)
    events_result = await db.execute(
        select(CalendarEvent.id, CalendarEvent.title, CalendarEvent.start_time)
        .where(
            and_(
                CalendarEvent.user_id == user.id,
                CalendarEvent.start_time >= now,
                CalendarEvent.start_time <= week_end,
            )
        )
        .order_by(CalendarEvent.start_time)
        .limit(10)
    )
    upcoming_events_rows = events_result.all()
    upcoming_events = [
        {"id": r.id, "title": r.title, "start_time": r.start_time.isoformat()}
        for r in upcoming_events_rows
    ]

    return {
        "tasks": {
            "total": total_tasks,
            "active": active_tasks,
            "done": done_tasks,
            "overdue": overdue_count,
            "completion_rate": completion_rate,
            "by_status": task_counts,
        },
        "job_hunt": {
            "active_applications": active_applications,
            "upcoming_interviews": upcoming_interviews,
        },
        "calendar": {
            "upcoming_count": len(upcoming_events),
            "upcoming_events": upcoming_events,
        },
    }
