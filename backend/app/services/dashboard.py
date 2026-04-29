"""Dashboard summary service — aggregates metrics across all modules."""
import re
from datetime import datetime, timedelta, timezone

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.calendar import CalendarEvent
from app.models.job import ApplicationStatus, Job
from app.models.reminder import Reminder, ReminderStatus
from app.models.telegram import PulseDigest, PulseDigestItem
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
    """Aggregated dashboard metrics across actions, jobs, and calendar."""
    now = datetime.now(tz=timezone.utc)
    today = now.date()

    # ── Actions ───────────────────────────────────────────────────────────────
    action_result = await db.execute(
        select(Reminder.status, func.count(Reminder.id).label("count"))
        .where(Reminder.user_id == user.id)
        .group_by(Reminder.status)
    )
    action_counts: dict[str, int] = {
        r.status.value if hasattr(r.status, "value") else str(r.status): r.count
        for r in action_result.all()
    }

    total_actions = sum(action_counts.values())
    done_actions = action_counts.get(ReminderStatus.done.value, 0)
    active_actions = action_counts.get(ReminderStatus.pending.value, 0)
    completion_rate = (
        round(done_actions / total_actions * 100, 1)
        if total_actions > 0
        else 0.0
    )

    overdue_count_result = await db.execute(
        select(func.count(Reminder.id))
        .where(
            and_(
                Reminder.user_id == user.id,
                Reminder.status == ReminderStatus.pending,
                or_(
                    Reminder.action_date < today,
                    Reminder.remind_at < now,
                    Reminder.snoozed_until < now,
                ),
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
        "actions": {
            "total": total_actions,
            "active": active_actions,
            "done": done_actions,
            "overdue": overdue_count,
            "completion_rate": completion_rate,
            "by_status": action_counts,
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


_CONTENT_PREVIEW_LENGTH = 200
_MAX_PREVIEW_ITEMS = 5
_PULSE_CATEGORIES = ["news", "jobs", "learning"]

_BOLD_TITLE_RE = re.compile(r"^[-*]\s+\*\*(.+?)\*\*")


def _extract_preview_items(content: str | None) -> list[dict]:
    """Extract up to 5 headline items from markdown digest content."""
    if not content:
        return []

    # Try bold-title pattern: - **Title**: description
    items: list[dict] = []
    for line in content.splitlines():
        m = _BOLD_TITLE_RE.match(line.strip())
        if m:
            items.append({"title": m.group(1).strip(), "classification": None})
            if len(items) >= _MAX_PREVIEW_ITEMS:
                break

    if items:
        return items

    # Fallback: first N non-heading, non-empty lines trimmed to first sentence
    for line in content.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        # Take first sentence
        sentence = stripped.split(". ")[0].rstrip(".")
        items.append({"title": sentence, "classification": None})
        if len(items) >= _MAX_PREVIEW_ITEMS:
            break

    return items


async def _get_structured_preview_items(
    db: AsyncSession, digest_id: int
) -> list[dict]:
    """Query PulseDigestItem table for first 5 items of a structured digest."""
    result = await db.execute(
        select(PulseDigestItem.title, PulseDigestItem.classification)
        .where(PulseDigestItem.digest_id == digest_id)
        .order_by(PulseDigestItem.id)
        .limit(_MAX_PREVIEW_ITEMS)
    )
    return [
        {"title": row.title, "classification": row.classification}
        for row in result.all()
    ]


def _strip_markdown_emphasis(text: str) -> str:
    """Remove markdown emphasis markers (* and **) from text."""
    import re
    # Replace **bold** and *italic* markers, keeping inner text
    return re.sub(r"\*{1,2}(.+?)\*{1,2}", r"\1", text)


def _extract_preview(content: str | None) -> str:
    """Extract first meaningful lines from markdown digest content."""
    if not content:
        return ""
    lines = []
    for line in content.splitlines():
        stripped = line.strip()
        # Skip markdown headings and empty lines
        if not stripped or stripped.startswith("#"):
            continue
        lines.append(stripped)
        if len(" ".join(lines)) >= _CONTENT_PREVIEW_LENGTH:
            break
    preview = _strip_markdown_emphasis(" ".join(lines))
    if len(preview) > _CONTENT_PREVIEW_LENGTH:
        preview = preview[:_CONTENT_PREVIEW_LENGTH].rsplit(" ", 1)[0] + "…"
    return preview


async def get_pulse_summary(db: AsyncSession, user: User) -> dict:
    """Latest digest per category for the dashboard widget."""
    from sqlalchemy import desc

    # Get latest digest per category using a subquery
    digests: list[dict] = []

    for cat in _PULSE_CATEGORIES:
        result = await db.execute(
            select(PulseDigest)
            .where(
                PulseDigest.user_id == user.id,
                PulseDigest.category == cat,
            )
            .order_by(desc(PulseDigest.generated_at))
            .limit(1)
        )
        digest = result.scalar_one_or_none()
        if digest is not None:
            if digest.digest_type == "structured":
                preview_items = await _get_structured_preview_items(db, digest.id)
            else:
                preview_items = _extract_preview_items(digest.content)

            digests.append({
                "id": digest.id,
                "category": digest.category,
                "content_preview": _extract_preview(digest.content),
                "message_count": digest.message_count,
                "items_count": digest.items_count,
                "generated_at": digest.generated_at,
                "preview_items": preview_items,
            })

    # Compute overall period from all returned digests
    period_start = None
    period_end = None
    if digests:
        # Get the actual digest objects' period fields
        all_ids = [d["id"] for d in digests]
        period_result = await db.execute(
            select(
                func.min(PulseDigest.period_start),
                func.max(PulseDigest.period_end),
            ).where(PulseDigest.id.in_(all_ids))
        )
        row = period_result.one()
        period_start = row[0]
        period_end = row[1]

    return {
        "digests": digests,
        "period_start": period_start,
        "period_end": period_end,
    }
