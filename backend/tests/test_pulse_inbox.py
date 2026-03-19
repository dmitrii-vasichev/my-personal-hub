"""
Tests for Phase 36: Learning Inbox & Notes Write.
Covers: inbox schemas, inbox service, inbox API endpoints.
"""
from __future__ import annotations

import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from httpx import ASGITransport, AsyncClient

from app.main import app
from app.models.telegram import PulseMessage, PulseSource
from app.models.user import User, UserRole
from app.schemas.pulse_inbox import (
    BulkActionRequest,
    InboxAction,
    InboxActionRequest,
    InboxItemResponse,
    InboxListResponse,
)


# ── Helpers ──────────────────────────────────────────────────────────────────


def make_user(user_id: int = 1) -> User:
    u = User()
    u.id = user_id
    u.role = UserRole.admin
    u.email = f"user{user_id}@example.com"
    u.display_name = f"User {user_id}"
    return u


def make_message(
    msg_id: int = 1,
    user_id: int = 1,
    source_id: int = 1,
    category: str = "learning",
    text: str = "Test learning content",
    status: str = "new",
    relevance: float | None = 0.9,
    classification: str | None = "article",
) -> PulseMessage:
    m = PulseMessage()
    m.id = msg_id
    m.user_id = user_id
    m.source_id = source_id
    m.telegram_message_id = msg_id * 100
    m.text = text
    m.sender_name = "TestSender"
    m.category = category
    m.status = status
    m.ai_relevance = relevance
    m.ai_classification = classification
    m.message_date = datetime(2026, 3, 16, 10, 0, 0, tzinfo=timezone.utc)
    m.collected_at = datetime(2026, 3, 16, 10, 0, 0, tzinfo=timezone.utc)
    return m


def make_source(source_id: int = 1, title: str = "Learning Channel") -> PulseSource:
    s = PulseSource()
    s.id = source_id
    s.user_id = 1
    s.telegram_id = -1001234567890
    s.title = title
    s.category = "learning"
    return s


# ── 1. Schema tests ─────────────────────────────────────────────────────────


def test_inbox_action_enum():
    """InboxAction enum has correct values."""
    assert InboxAction.to_task == "to_task"
    assert InboxAction.to_note == "to_note"
    assert InboxAction.skip == "skip"


def test_inbox_action_request():
    """InboxActionRequest validates action."""
    req = InboxActionRequest(action=InboxAction.to_task)
    assert req.action == InboxAction.to_task


def test_bulk_action_request():
    """BulkActionRequest validates message_ids and action."""
    req = BulkActionRequest(message_ids=[1, 2, 3], action=InboxAction.skip)
    assert len(req.message_ids) == 3
    assert req.action == InboxAction.skip


def test_inbox_item_response():
    """InboxItemResponse can be created with all fields."""
    item = InboxItemResponse(
        id=1,
        text="Test content",
        sender_name="Sender",
        message_date=datetime(2026, 3, 16, tzinfo=timezone.utc),
        source_title="Channel",
        source_id=1,
        ai_classification="article",
        ai_relevance=0.9,
        status="new",
        collected_at=datetime(2026, 3, 16, tzinfo=timezone.utc),
    )
    assert item.id == 1
    assert item.ai_classification == "article"


def test_inbox_list_response():
    """InboxListResponse wraps items and total."""
    resp = InboxListResponse(items=[], total=0)
    assert resp.total == 0
    assert resp.items == []


# ── 2. Inbox service — get_inbox_items ───────────────────────────────────────


@pytest.mark.asyncio
async def test_get_inbox_items_returns_learning_messages():
    """get_inbox_items returns learning messages with classification."""
    from app.services import pulse_inbox

    msg1 = make_message(msg_id=1, classification="article")
    msg2 = make_message(msg_id=2, classification="lifehack")

    mock_db = AsyncMock()

    # Mock count query
    mock_count_result = MagicMock()
    mock_count_result.scalar.return_value = 2

    # Mock messages query
    mock_msg_result = MagicMock()
    mock_msg_result.scalars.return_value.all.return_value = [msg1, msg2]

    # Mock sources query
    mock_src_result = MagicMock()
    mock_src_result.all.return_value = [MagicMock(id=1, title="Learn Channel")]

    mock_db.execute = AsyncMock(
        side_effect=[mock_count_result, mock_msg_result, mock_src_result]
    )

    items, total = await pulse_inbox.get_inbox_items(mock_db, user_id=1)

    assert total == 2
    assert len(items) == 2
    assert items[0].ai_classification == "article"
    assert items[1].ai_classification == "lifehack"


@pytest.mark.asyncio
async def test_get_inbox_items_with_classification_filter():
    """get_inbox_items filters by classification."""
    from app.services import pulse_inbox

    msg1 = make_message(msg_id=1, classification="article")

    mock_db = AsyncMock()
    mock_count_result = MagicMock()
    mock_count_result.scalar.return_value = 1
    mock_msg_result = MagicMock()
    mock_msg_result.scalars.return_value.all.return_value = [msg1]
    mock_src_result = MagicMock()
    mock_src_result.all.return_value = [MagicMock(id=1, title="Channel")]

    mock_db.execute = AsyncMock(
        side_effect=[mock_count_result, mock_msg_result, mock_src_result]
    )

    items, total = await pulse_inbox.get_inbox_items(
        mock_db, user_id=1, classification="article"
    )

    assert total == 1
    assert len(items) == 1


# ── 3. Inbox service — process_action ────────────────────────────────────────


@pytest.mark.asyncio
async def test_process_action_skip():
    """process_action skip sets status to 'skipped'."""
    from app.services import pulse_inbox

    msg = make_message(msg_id=1)
    user = make_user()

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = msg
    mock_db.execute.return_value = mock_result
    mock_db.commit = AsyncMock()

    ok = await pulse_inbox.process_action(mock_db, user, 1, InboxAction.skip)

    assert ok is True
    assert msg.status == "skipped"
    mock_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_process_action_to_task():
    """process_action to_task creates a task and marks message as actioned."""
    from app.services import pulse_inbox

    msg = make_message(msg_id=1, text="Great article about Python")
    user = make_user()

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = msg
    mock_db.execute.return_value = mock_result
    mock_db.commit = AsyncMock()

    with patch("app.services.pulse_inbox.task_service.create_task", new_callable=AsyncMock) as mock_create:
        mock_create.return_value = MagicMock(id=42)
        ok = await pulse_inbox.process_action(mock_db, user, 1, InboxAction.to_task)

    assert ok is True
    assert msg.status == "actioned"
    mock_create.assert_awaited_once()
    # Check task title contains [Pulse] prefix
    call_args = mock_create.call_args
    task_data = call_args.args[1]
    assert task_data.title.startswith("[Pulse]")


@pytest.mark.asyncio
async def test_process_action_to_note():
    """process_action to_note creates a note and marks message as actioned."""
    from app.services import pulse_inbox

    msg = make_message(msg_id=1, text="Interesting insight about AI")
    user = make_user()
    mock_creds = MagicMock()

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = msg
    mock_db.execute.return_value = mock_result
    mock_db.commit = AsyncMock()

    with patch("app.services.pulse_inbox.note_service.create_note", new_callable=AsyncMock) as mock_create:
        mock_create.return_value = MagicMock(id=10)
        ok = await pulse_inbox.process_action(
            mock_db, user, 1, InboxAction.to_note, mock_creds, "folder_id"
        )

    assert ok is True
    assert msg.status == "actioned"
    mock_create.assert_awaited_once()


@pytest.mark.asyncio
async def test_process_action_message_not_found():
    """process_action returns False for non-existent message."""
    from app.services import pulse_inbox

    user = make_user()
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_db.execute.return_value = mock_result

    ok = await pulse_inbox.process_action(mock_db, user, 999, InboxAction.skip)
    assert ok is False


@pytest.mark.asyncio
async def test_process_action_to_note_without_credentials():
    """process_action to_note raises ValueError without credentials."""
    from app.services import pulse_inbox

    msg = make_message(msg_id=1)
    user = make_user()

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = msg
    mock_db.execute.return_value = mock_result

    with pytest.raises(ValueError, match="credentials"):
        await pulse_inbox.process_action(mock_db, user, 1, InboxAction.to_note)


# ── 4. Inbox service — bulk_action ───────────────────────────────────────────


@pytest.mark.asyncio
async def test_bulk_action_processes_multiple():
    """bulk_action processes multiple items."""
    from app.services import pulse_inbox

    user = make_user()

    with patch.object(pulse_inbox, "process_action", new_callable=AsyncMock) as mock_action:
        mock_action.return_value = True
        count = await pulse_inbox.bulk_action(
            AsyncMock(), user, [1, 2, 3], InboxAction.skip
        )

    assert count == 3
    assert mock_action.await_count == 3


# ── 5. Helper — _extract_title ───────────────────────────────────────────────


def test_extract_title_short():
    """_extract_title returns first line for short text."""
    from app.services.pulse_inbox import _extract_title
    assert _extract_title("Hello World\nMore text") == "Hello World"


def test_extract_title_long():
    """_extract_title truncates long first lines."""
    from app.services.pulse_inbox import _extract_title
    long_text = "A" * 100
    result = _extract_title(long_text)
    assert len(result) <= 83  # 80 + "..."
    assert result.endswith("...")


def test_extract_title_none():
    """_extract_title returns 'Untitled' for None."""
    from app.services.pulse_inbox import _extract_title
    assert _extract_title(None) == "Untitled"


# ── 6. API endpoint tests ───────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_inbox_api_removed():
    """Inbox endpoints return 404 — removed in Phase 40 (replaced by digest items)."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        resp = await client.get("/api/pulse/inbox/")
        assert resp.status_code in (404, 307)

        resp = await client.post("/api/pulse/inbox/1/action", json={"action": "skip"})
        assert resp.status_code in (404, 307)

        resp = await client.post(
            "/api/pulse/inbox/bulk-action",
            json={"message_ids": [1], "action": "skip"},
        )
        assert resp.status_code in (404, 307)
