"""
Tests for Pulse polling status tracking and poll-status endpoint.
Covers Phase 39 — Pulse Polling Feedback.
"""
from __future__ import annotations

import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from httpx import ASGITransport, AsyncClient

from app.main import app
from app.models.telegram import PulseSource
from app.models.user import User, UserRole
from app.schemas.pulse_source import PollStatusResponse, PollStatusSourceResponse


# ── Helpers ──────────────────────────────────────────────────────────────────


def make_user(user_id: int = 1) -> User:
    u = User()
    u.id = user_id
    u.role = UserRole.admin
    u.email = f"user{user_id}@example.com"
    u.display_name = f"User {user_id}"
    return u


def make_source(
    source_id: int = 1,
    poll_status: str = "idle",
    last_poll_error: str | None = None,
    last_poll_message_count: int = 0,
    last_polled_at: datetime | None = None,
) -> PulseSource:
    s = PulseSource()
    s.id = source_id
    s.user_id = 1
    s.telegram_id = -1001234567890 + source_id
    s.username = f"channel_{source_id}"
    s.title = f"Channel {source_id}"
    s.category = "news"
    s.subcategory = None
    s.keywords = None
    s.criteria = None
    s.is_active = True
    s.last_polled_at = last_polled_at
    s.poll_status = poll_status
    s.last_poll_error = last_poll_error
    s.last_poll_message_count = last_poll_message_count
    s.created_at = datetime(2026, 3, 16, 12, 0, 0, tzinfo=timezone.utc)
    return s


# ── Schema tests ────────────────────────────────────────────────────────────


class TestPollStatusSchemas:
    def test_poll_status_source_response(self):
        source = make_source(poll_status="polling")
        resp = PollStatusSourceResponse.model_validate(source)
        assert resp.poll_status == "polling"
        assert resp.last_poll_error is None
        assert resp.last_poll_message_count == 0

    def test_poll_status_response_any_polling_true(self):
        sources = [
            PollStatusSourceResponse(
                id=1, title="A", poll_status="polling",
                last_poll_error=None, last_poll_message_count=0, last_polled_at=None,
            ),
            PollStatusSourceResponse(
                id=2, title="B", poll_status="idle",
                last_poll_error=None, last_poll_message_count=3, last_polled_at=None,
            ),
        ]
        resp = PollStatusResponse(sources=sources, any_polling=True)
        assert resp.any_polling is True
        assert len(resp.sources) == 2

    def test_poll_status_response_any_polling_false(self):
        sources = [
            PollStatusSourceResponse(
                id=1, title="A", poll_status="idle",
                last_poll_error=None, last_poll_message_count=5, last_polled_at=None,
            ),
        ]
        resp = PollStatusResponse(sources=sources, any_polling=False)
        assert resp.any_polling is False

    def test_poll_status_error_source(self):
        source = make_source(
            poll_status="error",
            last_poll_error="Connection timeout",
            last_poll_message_count=0,
        )
        resp = PollStatusSourceResponse.model_validate(source)
        assert resp.poll_status == "error"
        assert resp.last_poll_error == "Connection timeout"


# ── Collector poll status tracking tests ────────────────────────────────────


class TestCollectorPollStatus:
    @pytest.mark.asyncio
    async def test_collect_source_sets_polling_then_idle(self):
        """collect_source should set poll_status to 'polling' then 'idle' on success."""
        from app.services.pulse_collector import collect_source

        user = make_user()
        source = make_source()
        assert source.poll_status == "idle"

        mock_client = AsyncMock()
        mock_client.get_entity = AsyncMock(return_value=MagicMock())
        mock_client.iter_messages = MagicMock(return_value=AsyncIteratorMock([]))

        mock_db = AsyncMock()
        mock_db.flush = AsyncMock()
        mock_db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=None)))

        with patch("app.services.pulse_collector.get_client_for_user", return_value=mock_client):
            count = await collect_source(mock_db, user, source)

        assert source.poll_status == "idle"
        assert source.last_poll_error is None
        assert source.last_poll_message_count == 0
        assert count == 0

    @pytest.mark.asyncio
    async def test_collect_source_sets_error_on_failure(self):
        """collect_source should set poll_status to 'error' on exception."""
        from app.services.pulse_collector import collect_source

        user = make_user()
        source = make_source()

        mock_client = AsyncMock()
        mock_client.get_entity = AsyncMock(side_effect=Exception("Connection failed"))

        mock_db = AsyncMock()
        mock_db.flush = AsyncMock()

        with patch("app.services.pulse_collector.get_client_for_user", return_value=mock_client):
            count = await collect_source(mock_db, user, source)

        assert source.poll_status == "error"
        assert "Connection failed" in source.last_poll_error
        assert source.last_poll_message_count == 0
        assert count == 0

    @pytest.mark.asyncio
    async def test_collect_source_sets_error_when_no_client(self):
        """collect_source should set poll_status to 'error' when no Telegram client."""
        from app.services.pulse_collector import collect_source

        user = make_user()
        source = make_source()

        mock_db = AsyncMock()
        mock_db.flush = AsyncMock()

        with patch("app.services.pulse_collector.get_client_for_user", return_value=None):
            count = await collect_source(mock_db, user, source)

        assert source.poll_status == "error"
        assert "No Telegram client" in source.last_poll_error
        assert count == 0

    @pytest.mark.asyncio
    async def test_collect_source_tracks_message_count(self):
        """collect_source should set last_poll_message_count to number of new messages."""
        from app.services.pulse_collector import collect_source

        user = make_user()
        source = make_source()

        mock_msg1 = MagicMock()
        mock_msg1.text = "New Python job"
        mock_msg1.id = 101
        mock_msg1.sender = None
        mock_msg1.date = datetime(2026, 3, 16, 10, 0, 0, tzinfo=timezone.utc)

        mock_msg2 = MagicMock()
        mock_msg2.text = "AI workshop"
        mock_msg2.id = 102
        mock_msg2.sender = None
        mock_msg2.date = datetime(2026, 3, 16, 11, 0, 0, tzinfo=timezone.utc)

        mock_client = AsyncMock()
        mock_client.get_entity = AsyncMock(return_value=MagicMock())
        mock_client.iter_messages = MagicMock(return_value=AsyncIteratorMock([mock_msg1, mock_msg2]))

        # Mock DB: no existing messages (dedup check returns None)
        mock_result = MagicMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=None)
        mock_db = AsyncMock()
        mock_db.flush = AsyncMock()
        mock_db.execute = AsyncMock(return_value=mock_result)
        mock_db.add = MagicMock()

        with patch("app.services.pulse_collector.get_client_for_user", return_value=mock_client), \
             patch("app.services.pulse_collector.keyword_filter", return_value=True):
            count = await collect_source(mock_db, user, source)

        assert count == 2
        assert source.poll_status == "idle"
        assert source.last_poll_message_count == 2


# ── API endpoint tests ──────────────────────────────────────────────────────


class TestPollStatusAPI:
    def setup_method(self):
        from app.core.deps import get_current_user
        from app.core.database import get_db

        self._user = make_user()
        self._mock_db = AsyncMock()
        app.dependency_overrides[get_current_user] = lambda: self._user
        app.dependency_overrides[get_db] = lambda: self._mock_db

    def teardown_method(self):
        app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_poll_status_endpoint_idle(self):
        source = make_source(poll_status="idle", last_poll_message_count=5)

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [source]
        self._mock_db.execute = AsyncMock(return_value=mock_result)

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/pulse/sources/poll-status")

        assert response.status_code == 200
        data = response.json()
        assert data["any_polling"] is False
        assert len(data["sources"]) == 1
        assert data["sources"][0]["poll_status"] == "idle"
        assert data["sources"][0]["last_poll_message_count"] == 5

    @pytest.mark.asyncio
    async def test_poll_status_endpoint_polling(self):
        source1 = make_source(source_id=1, poll_status="polling")
        source2 = make_source(source_id=2, poll_status="idle", last_poll_message_count=3)

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [source1, source2]
        self._mock_db.execute = AsyncMock(return_value=mock_result)

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/pulse/sources/poll-status")

        assert response.status_code == 200
        data = response.json()
        assert data["any_polling"] is True

    @pytest.mark.asyncio
    async def test_poll_status_endpoint_error(self):
        source = make_source(
            poll_status="error",
            last_poll_error="Connection timeout",
        )

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [source]
        self._mock_db.execute = AsyncMock(return_value=mock_result)

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/pulse/sources/poll-status")

        assert response.status_code == 200
        data = response.json()
        assert data["any_polling"] is False
        assert data["sources"][0]["poll_status"] == "error"
        assert data["sources"][0]["last_poll_error"] == "Connection timeout"


# ── Async iterator mock helper ──────────────────────────────────────────────


class AsyncIteratorMock:
    """Helper to mock async for loops (client.iter_messages)."""
    def __init__(self, items):
        self._items = items
        self._index = 0

    def __aiter__(self):
        return self

    async def __anext__(self):
        if self._index >= len(self._items):
            raise StopAsyncIteration
        item = self._items[self._index]
        self._index += 1
        return item
