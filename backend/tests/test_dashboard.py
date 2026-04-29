"""
Unit tests for dashboard service — mocked DB.
"""
import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock

from app.models.job import ApplicationStatus
from app.models.reminder import ReminderStatus
from app.models.user import User, UserRole
from app.services import dashboard as dashboard_service


def make_user(user_id: int = 1) -> User:
    u = User()
    u.id = user_id
    u.role = UserRole.member
    u.email = f"user{user_id}@example.com"
    u.display_name = f"User {user_id}"
    return u


def make_row(**kwargs):
    """Create a simple mock row with attributes."""
    row = MagicMock()
    for k, v in kwargs.items():
        setattr(row, k, v)
    return row


@pytest.mark.asyncio
async def test_get_summary_empty():
    """Returns zeroed metrics when user has no data."""
    db = AsyncMock()

    # Action status query → empty
    action_result = MagicMock()
    action_result.all.return_value = []

    # Overdue count → 0
    overdue_result = MagicMock()
    overdue_result.scalar_one.return_value = 0

    # App status query → empty
    app_result = MagicMock()
    app_result.all.return_value = []

    # Upcoming events → empty
    events_result = MagicMock()
    events_result.all.return_value = []

    db.execute = AsyncMock(side_effect=[action_result, overdue_result, app_result, events_result])

    user = make_user()
    result = await dashboard_service.get_summary(db, user)

    assert result["actions"]["total"] == 0
    assert result["actions"]["active"] == 0
    assert result["actions"]["done"] == 0
    assert result["actions"]["overdue"] == 0
    assert result["actions"]["completion_rate"] == 0.0
    assert result["job_hunt"]["active_applications"] == 0
    assert result["job_hunt"]["upcoming_interviews"] == 0
    assert result["calendar"]["upcoming_count"] == 0
    assert result["calendar"]["upcoming_events"] == []


@pytest.mark.asyncio
async def test_get_summary_with_actions():
    """Action metrics are calculated correctly."""
    db = AsyncMock()

    action_row_pending = make_row(status=ReminderStatus.pending, count=5)
    action_row_done = make_row(status=ReminderStatus.done, count=5)
    action_result = MagicMock()
    action_result.all.return_value = [action_row_pending, action_row_done]

    overdue_result = MagicMock()
    overdue_result.scalar_one.return_value = 2

    app_result = MagicMock()
    app_result.all.return_value = []

    events_result = MagicMock()
    events_result.all.return_value = []

    db.execute = AsyncMock(side_effect=[action_result, overdue_result, app_result, events_result])

    user = make_user()
    result = await dashboard_service.get_summary(db, user)

    assert result["actions"]["total"] == 10
    assert result["actions"]["done"] == 5
    assert result["actions"]["active"] == 5
    assert result["actions"]["overdue"] == 2
    assert result["actions"]["completion_rate"] == 50.0


@pytest.mark.asyncio
async def test_get_summary_job_hunt():
    """Job hunt metrics: active apps and upcoming interviews."""
    db = AsyncMock()

    action_result = MagicMock()
    action_result.all.return_value = []
    overdue_result = MagicMock()
    overdue_result.scalar_one.return_value = 0

    # Apps: 3 applied, 1 technical_interview, 1 final_interview, 2 rejected
    app_rows = [
        make_row(status=ApplicationStatus.applied, count=3),
        make_row(status=ApplicationStatus.technical_interview, count=1),
        make_row(status=ApplicationStatus.final_interview, count=1),
        make_row(status=ApplicationStatus.rejected, count=2),
    ]
    app_result = MagicMock()
    app_result.all.return_value = app_rows

    events_result = MagicMock()
    events_result.all.return_value = []

    db.execute = AsyncMock(side_effect=[action_result, overdue_result, app_result, events_result])

    user = make_user()
    result = await dashboard_service.get_summary(db, user)

    # active = applied(3) + technical_interview(1) + final_interview(1) = 5
    # rejected(2) is inactive
    assert result["job_hunt"]["active_applications"] == 5
    assert result["job_hunt"]["upcoming_interviews"] == 2


@pytest.mark.asyncio
async def test_get_summary_calendar_events():
    """Calendar events are included with correct fields."""
    db = AsyncMock()

    action_result = MagicMock()
    action_result.all.return_value = []
    overdue_result = MagicMock()
    overdue_result.scalar_one.return_value = 0
    app_result = MagicMock()
    app_result.all.return_value = []

    now = datetime.now(tz=timezone.utc)
    event_row = make_row(
        id=42,
        title="Team standup",
        start_time=now + timedelta(hours=2),
    )
    events_result = MagicMock()
    events_result.all.return_value = [event_row]

    db.execute = AsyncMock(side_effect=[action_result, overdue_result, app_result, events_result])

    user = make_user()
    result = await dashboard_service.get_summary(db, user)

    assert result["calendar"]["upcoming_count"] == 1
    assert result["calendar"]["upcoming_events"][0]["id"] == 42
    assert result["calendar"]["upcoming_events"][0]["title"] == "Team standup"
    assert "start_time" in result["calendar"]["upcoming_events"][0]


# ── Pulse summary ────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_pulse_summary_empty():
    """Returns empty digests list when user has no digests."""
    db = AsyncMock()

    # 3 category queries → each returns None
    no_digest = MagicMock()
    no_digest.scalar_one_or_none.return_value = None

    db.execute = AsyncMock(return_value=no_digest)

    user = make_user()
    result = await dashboard_service.get_pulse_summary(db, user)

    assert result["digests"] == []
    assert result["period_start"] is None
    assert result["period_end"] is None


@pytest.mark.asyncio
async def test_get_pulse_summary_with_digests():
    """Returns latest digest per category with content preview."""
    db = AsyncMock()

    now = datetime.now(tz=timezone.utc)

    news_digest = MagicMock()
    news_digest.id = 10
    news_digest.category = "news"
    news_digest.content = "# News\n\nApple launched a new product today. EU updated AI policy."
    news_digest.digest_type = "markdown"
    news_digest.message_count = 42
    news_digest.generated_at = now

    jobs_digest = MagicMock()
    jobs_digest.id = 11
    jobs_digest.category = "jobs"
    jobs_digest.content = "# Jobs\n\n⭐ Senior Python Developer at Revolut."
    jobs_digest.digest_type = "markdown"
    jobs_digest.message_count = 25
    jobs_digest.generated_at = now

    no_digest = MagicMock()
    no_digest.scalar_one_or_none.return_value = None

    news_result = MagicMock()
    news_result.scalar_one_or_none.return_value = news_digest

    jobs_result = MagicMock()
    jobs_result.scalar_one_or_none.return_value = jobs_digest

    learning_result = MagicMock()
    learning_result.scalar_one_or_none.return_value = None

    # Period aggregation query
    period_result = MagicMock()
    period_result.one.return_value = (
        now - timedelta(days=1),
        now,
    )

    db.execute = AsyncMock(
        side_effect=[news_result, jobs_result, learning_result, period_result]
    )

    user = make_user()
    result = await dashboard_service.get_pulse_summary(db, user)

    assert len(result["digests"]) == 2
    assert result["digests"][0]["category"] == "news"
    assert result["digests"][0]["message_count"] == 42
    assert "Apple launched" in result["digests"][0]["content_preview"]
    assert result["digests"][1]["category"] == "jobs"
    assert result["period_start"] is not None
    assert result["period_end"] is not None


@pytest.mark.asyncio
async def test_extract_preview_skips_headings():
    """Content preview skips markdown headings and empty lines."""
    content = "# Heading\n\n## Sub\n\nActual content here.\nMore content."
    preview = dashboard_service._extract_preview(content)
    assert preview.startswith("Actual content here.")
    assert "#" not in preview


@pytest.mark.asyncio
async def test_extract_preview_strips_markdown_emphasis():
    """Content preview strips markdown *italic* and **bold** markers."""
    content = "*Tech Policy Watch*\n\nThe EU AI Act enters enforcement."
    preview = dashboard_service._extract_preview(content)
    assert "*" not in preview
    assert "Tech Policy Watch" in preview


@pytest.mark.asyncio
async def test_extract_preview_none_content():
    """Structured digests have content=None — preview must not crash."""
    assert dashboard_service._extract_preview(None) == ""


@pytest.mark.asyncio
async def test_get_pulse_summary_structured_digest():
    """Structured digest with content=None should appear in summary."""
    db = AsyncMock()
    now = datetime.now(tz=timezone.utc)

    learning_digest = MagicMock()
    learning_digest.id = 20
    learning_digest.category = "learning"
    learning_digest.content = None  # structured digest
    learning_digest.digest_type = "structured"
    learning_digest.message_count = 24
    learning_digest.items_count = 5
    learning_digest.generated_at = now

    news_result = MagicMock()
    news_result.scalar_one_or_none.return_value = None

    jobs_result = MagicMock()
    jobs_result.scalar_one_or_none.return_value = None

    learning_result = MagicMock()
    learning_result.scalar_one_or_none.return_value = learning_digest

    # PulseDigestItem query for structured digest
    items_result = MagicMock()
    items_result.all.return_value = [
        make_row(title="Learn Python async", classification="tutorial"),
        make_row(title="New FastAPI features", classification="article"),
    ]

    period_result = MagicMock()
    period_result.one.return_value = (now - timedelta(days=1), now)

    db.execute = AsyncMock(
        side_effect=[news_result, jobs_result, learning_result, items_result, period_result]
    )

    user = make_user()
    result = await dashboard_service.get_pulse_summary(db, user)

    assert len(result["digests"]) == 1
    assert result["digests"][0]["category"] == "learning"
    assert result["digests"][0]["content_preview"] == ""
    assert result["digests"][0]["items_count"] == 5
    assert len(result["digests"][0]["preview_items"]) == 2
    assert result["digests"][0]["preview_items"][0]["title"] == "Learn Python async"
    assert result["digests"][0]["preview_items"][0]["classification"] == "tutorial"
