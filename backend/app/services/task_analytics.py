"""
Task analytics service — aggregations over user's tasks.
"""
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.task import Task, TaskStatus, TaskPriority
from app.models.user import User


async def get_status_distribution(db: AsyncSession, user: User) -> list[dict]:
    """Task count per status."""
    result = await db.execute(
        select(Task.status, func.count(Task.id).label("count"))
        .where(Task.user_id == user.id)
        .group_by(Task.status)
    )
    counts = {str(r.status.value): r.count for r in result.all()}
    return [{"status": s.value, "count": counts.get(s.value, 0)} for s in TaskStatus]


async def get_priority_distribution(db: AsyncSession, user: User) -> list[dict]:
    """Task count per priority (excluding done/cancelled)."""
    result = await db.execute(
        select(Task.priority, func.count(Task.id).label("count"))
        .where(Task.user_id == user.id)
        .group_by(Task.priority)
    )
    counts = {str(r.priority.value): r.count for r in result.all()}
    return [{"priority": p.value, "count": counts.get(p.value, 0)} for p in TaskPriority]


async def get_completion_rate(db: AsyncSession, user: User, weeks: int = 12) -> list[dict]:
    """Weekly completion rate (done tasks / created tasks) for last N weeks."""
    since = datetime.now(tz=timezone.utc) - timedelta(weeks=weeks)

    created_result = await db.execute(
        select(Task.created_at)
        .where(Task.user_id == user.id, Task.created_at >= since)
    )
    created_rows = created_result.scalars().all()

    done_result = await db.execute(
        select(Task.completed_at)
        .where(
            Task.user_id == user.id,
            Task.status == TaskStatus.done,
            Task.completed_at >= since,
        )
    )
    done_rows = done_result.scalars().all()

    # Group by week
    created_by_week: dict[str, int] = {}
    for dt in created_rows:
        label = dt.strftime("%Y-W%W")
        created_by_week[label] = created_by_week.get(label, 0) + 1

    done_by_week: dict[str, int] = {}
    for dt in done_rows:
        label = dt.strftime("%Y-W%W")
        done_by_week[label] = done_by_week.get(label, 0) + 1

    now = datetime.now(tz=timezone.utc)
    points = []
    for i in range(weeks):
        d = now - timedelta(weeks=weeks - 1 - i)
        label = d.strftime("%Y-W%W")
        created = created_by_week.get(label, 0)
        done = done_by_week.get(label, 0)
        rate = round(done / created * 100, 1) if created > 0 else 0.0
        points.append({"week": label, "created": created, "done": done, "rate": rate})
    return points


async def get_overdue(db: AsyncSession, user: User) -> dict:
    """Count and list of overdue tasks (deadline passed, not done/cancelled)."""
    now = datetime.now(tz=timezone.utc)
    result = await db.execute(
        select(Task.id, Task.title, Task.deadline, Task.priority)
        .where(
            and_(
                Task.user_id == user.id,
                Task.deadline < now,
                Task.status.notin_([TaskStatus.done, TaskStatus.cancelled]),
            )
        )
        .order_by(Task.deadline)
        .limit(20)
    )
    rows = result.all()
    tasks = [
        {
            "id": r.id,
            "title": r.title,
            "deadline": r.deadline.isoformat(),
            "priority": r.priority.value,
        }
        for r in rows
    ]
    return {"count": len(tasks), "tasks": tasks}
