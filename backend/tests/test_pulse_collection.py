"""
Tests for Pulse message collection, keyword filter, AI filter, and TTL cleanup.
Covers Phase 34 — Message Collection & Filtering.
"""
from __future__ import annotations

import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from app.models.telegram import PulseSource
from app.models.user import User, UserRole


# ── Helpers ──────────────────────────────────────────────────────────────────


def make_user(user_id: int = 1) -> User:
    u = User()
    u.id = user_id
    u.role = UserRole.admin
    u.email = f"user{user_id}@example.com"
    u.display_name = f"User {user_id}"
    return u


def make_source(source_id: int = 1, keywords: list | None = None) -> PulseSource:
    s = PulseSource()
    s.id = source_id
    s.user_id = 1
    s.telegram_id = -1001234567890
    s.username = "test_channel"
    s.title = "Test Channel"
    s.category = "news"
    s.subcategory = None
    s.keywords = keywords
    s.criteria = None
    s.is_active = True
    s.last_polled_at = None
    s.created_at = datetime(2026, 3, 16, 12, 0, 0, tzinfo=timezone.utc)
    return s


# ── Keyword filter tests ────────────────────────────────────────────────────


class TestKeywordFilter:
    def test_keyword_filter_match(self):
        from app.services.pulse_filter import keyword_filter

        assert keyword_filter("Python developer needed", ["python", "react"]) is True

    def test_keyword_filter_no_match(self):
        from app.services.pulse_filter import keyword_filter

        assert keyword_filter("Java developer needed", ["python", "react"]) is False

    def test_keyword_filter_empty_keywords(self):
        from app.services.pulse_filter import keyword_filter

        assert keyword_filter("Any message text", None) is True
        assert keyword_filter("Any message text", []) is True

    def test_keyword_filter_case_insensitive(self):
        from app.services.pulse_filter import keyword_filter

        assert keyword_filter("PYTHON Developer", ["python"]) is True

    def test_keyword_filter_empty_text(self):
        from app.services.pulse_filter import keyword_filter

        assert keyword_filter(None, ["python"]) is False
        assert keyword_filter("", ["python"]) is False


# ── Collector tests ──────────────────────────────────────────────────────────


class TestCollector:
    @pytest.mark.asyncio
    @patch("app.services.pulse_collector.get_client_for_user")
    async def test_collect_source_stores_new_messages(self, mock_get_client):
        from app.services.pulse_collector import collect_source

        # Mock Telethon client
        mock_message = MagicMock()
        mock_message.id = 12345
        mock_message.text = "New Python course available!"
        mock_message.date = datetime.now(timezone.utc)
        mock_message.sender = MagicMock(first_name="John")

        mock_client = AsyncMock()
        mock_client.get_entity = AsyncMock(return_value=MagicMock())
        mock_client.disconnect = AsyncMock()

        async def mock_iter(*args, **kwargs):
            yield mock_message

        mock_client.iter_messages = mock_iter
        mock_get_client.return_value = mock_client

        # Mock DB — no existing message (dedup check returns None)
        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        db.execute = AsyncMock(return_value=mock_result)

        user = make_user()
        source = make_source()

        count = await collect_source(db, user, source, ttl_days=30)

        assert count == 1
        db.add.assert_called_once()

    @pytest.mark.asyncio
    @patch("app.services.pulse_collector.get_client_for_user")
    async def test_collect_source_deduplication(self, mock_get_client):
        from app.services.pulse_collector import collect_source

        mock_message = MagicMock()
        mock_message.id = 12345
        mock_message.text = "Already seen"
        mock_message.date = datetime.now(timezone.utc)
        mock_message.sender = None

        mock_client = AsyncMock()
        mock_client.get_entity = AsyncMock(return_value=MagicMock())
        mock_client.disconnect = AsyncMock()

        async def mock_iter(*args, **kwargs):
            yield mock_message

        mock_client.iter_messages = mock_iter
        mock_get_client.return_value = mock_client

        # Mock DB — existing message found (dedup hit)
        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = 999  # existing ID
        db.execute = AsyncMock(return_value=mock_result)

        user = make_user()
        source = make_source()

        count = await collect_source(db, user, source, ttl_days=30)

        assert count == 0
        db.add.assert_not_called()

    @pytest.mark.asyncio
    @patch("app.services.pulse_collector.get_client_for_user")
    async def test_collect_source_uses_message_limit(self, mock_get_client):
        from app.services.pulse_collector import collect_source

        mock_message = MagicMock()
        mock_message.id = 99999
        mock_message.text = "Test message"
        mock_message.date = datetime.now(timezone.utc)
        mock_message.sender = None

        mock_client = AsyncMock()
        mock_client.get_entity = AsyncMock(return_value=MagicMock())
        mock_client.disconnect = AsyncMock()

        captured_kwargs = {}

        async def mock_iter(*args, **kwargs):
            captured_kwargs.update(kwargs)
            yield mock_message

        mock_client.iter_messages = mock_iter
        mock_get_client.return_value = mock_client

        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        db.execute = AsyncMock(return_value=mock_result)

        user = make_user()
        source = make_source()

        await collect_source(db, user, source, ttl_days=30, message_limit=250)

        assert captured_kwargs["limit"] == 250

    @pytest.mark.asyncio
    @patch("app.services.pulse_collector.get_client_for_user")
    async def test_collect_source_no_client(self, mock_get_client):
        from app.services.pulse_collector import collect_source

        mock_get_client.return_value = None

        db = AsyncMock()
        user = make_user()
        source = make_source()

        count = await collect_source(db, user, source)
        assert count == 0


# ── AI filter tests ──────────────────────────────────────────────────────────


class TestAIFilter:
    @pytest.mark.asyncio
    async def test_ai_relevance_jobs_category(self):
        from app.services.pulse_ai_filter import analyze_relevance

        mock_llm = AsyncMock()
        mock_llm.generate = AsyncMock(
            return_value='{"relevance": 0.8, "classification": null}'
        )

        score, classification = await analyze_relevance(
            "Senior Python dev, 200k+", "jobs", {"stack": "python"}, mock_llm
        )

        assert score == 0.8
        assert classification is None
        mock_llm.generate.assert_called_once()

    @pytest.mark.asyncio
    async def test_ai_relevance_news_category(self):
        from app.services.pulse_ai_filter import analyze_relevance

        mock_llm = AsyncMock()

        score, classification = await analyze_relevance(
            "Breaking news", "news", None, mock_llm
        )

        assert score == 1.0
        assert classification is None
        mock_llm.generate.assert_not_called()

    @pytest.mark.asyncio
    async def test_ai_relevance_learning_category(self):
        from app.services.pulse_ai_filter import analyze_relevance

        mock_llm = AsyncMock()
        mock_llm.generate = AsyncMock(
            return_value='{"relevance": 0.9, "classification": "article"}'
        )

        score, classification = await analyze_relevance(
            "Great tutorial on React", "learning", None, mock_llm
        )

        assert score == 0.9
        assert classification == "article"

    @pytest.mark.asyncio
    async def test_ai_relevance_fallback_on_error(self):
        from app.services.pulse_ai_filter import analyze_relevance

        mock_llm = AsyncMock()
        mock_llm.generate = AsyncMock(side_effect=Exception("API error"))

        score, classification = await analyze_relevance(
            "Some text", "jobs", None, mock_llm
        )

        assert score == 0.5
        assert classification is None


# ── TTL cleanup tests ────────────────────────────────────────────────────────


class TestTTLCleanup:
    @pytest.mark.asyncio
    @patch("app.services.pulse_scheduler.async_session_factory")
    async def test_ttl_cleanup(self, mock_session_factory):
        from app.services.pulse_scheduler import run_ttl_cleanup

        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.rowcount = 5
        mock_db.execute = AsyncMock(return_value=mock_result)

        mock_context = AsyncMock()
        mock_context.__aenter__ = AsyncMock(return_value=mock_db)
        mock_context.__aexit__ = AsyncMock(return_value=False)
        mock_session_factory.return_value = mock_context

        await run_ttl_cleanup()

        mock_db.execute.assert_called_once()
        mock_db.commit.assert_called_once()
