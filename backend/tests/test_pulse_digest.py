"""
Tests for Pulse digest generation, prompt building, API endpoints, and scheduling.
Covers Phase 35 — AI Digests.
"""
from __future__ import annotations

import pytest
from datetime import datetime, time, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from httpx import ASGITransport, AsyncClient

from app.main import app
from app.models.telegram import PulseDigest, PulseMessage, PulseSource, PulseSettings
from app.models.user import User, UserRole


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
    category: str = "news",
    text: str = "Test message",
    status: str = "new",
    relevance: float | None = None,
    classification: str | None = None,
) -> PulseMessage:
    m = PulseMessage()
    m.id = msg_id
    m.user_id = user_id
    m.source_id = source_id
    m.telegram_message_id = msg_id * 100
    m.text = text
    m.category = category
    m.status = status
    m.ai_relevance = relevance
    m.ai_classification = classification
    m.message_date = datetime(2026, 3, 16, 10, 0, 0, tzinfo=timezone.utc)
    m.collected_at = datetime(2026, 3, 16, 10, 0, 0, tzinfo=timezone.utc)
    return m


def make_source(source_id: int = 1, category: str = "news", title: str = "Test Channel") -> PulseSource:
    s = PulseSource()
    s.id = source_id
    s.user_id = 1
    s.telegram_id = -1001234567890
    s.title = title
    s.category = category
    s.subcategory = None
    s.is_active = True
    return s


# ── Prompt builder tests ────────────────────────────────────────────────────


class TestPromptBuilder:
    def test_build_user_prompt_single_message(self):
        from app.services.pulse_digest import _build_user_prompt

        msg = make_message(text="Big news today")
        source = make_source()

        result = _build_user_prompt([msg], {1: source})

        assert "Test Channel" in result
        assert "Big news today" in result
        assert "Subcategory: General" in result

    def test_build_user_prompt_with_relevance(self):
        from app.services.pulse_digest import _build_user_prompt

        msg = make_message(
            text="Python dev job", category="jobs",
            relevance=0.9, classification=None,
        )
        source = make_source(category="jobs")

        result = _build_user_prompt([msg], {1: source})

        assert "[relevance: 0.9]" in result

    def test_build_user_prompt_with_classification(self):
        from app.services.pulse_digest import _build_user_prompt

        msg = make_message(
            text="Great article", category="learning",
            relevance=0.8, classification="article",
        )
        source = make_source(category="learning")

        result = _build_user_prompt([msg], {1: source})

        assert "[type: article]" in result

    def test_build_user_prompt_groups_by_source_subcategory(self):
        """Regression: subcategory grouping must use source.subcategory, not msg.category."""
        from app.services.pulse_digest import _build_user_prompt

        msg1 = make_message(msg_id=1, source_id=1, text="Russian event")
        msg2 = make_message(msg_id=2, source_id=2, text="Tech update")
        source1 = make_source(source_id=1, title="Varlamov News")
        source1.subcategory = "Russian News"
        source2 = make_source(source_id=2, title="TechCrunch")
        source2.subcategory = "Tech News"

        result = _build_user_prompt([msg1, msg2], {1: source1, 2: source2})

        assert "Subcategory: Russian News" in result
        assert "Subcategory: Tech News" in result
        # Must NOT fall back to message category
        assert "Subcategory: news" not in result

    def test_build_user_prompt_fallback_to_general(self):
        """Sources without subcategory should group under 'General'."""
        from app.services.pulse_digest import _build_user_prompt

        msg = make_message(text="Some news")
        source = make_source()
        source.subcategory = None

        result = _build_user_prompt([msg], {1: source})

        assert "Subcategory: General" in result

    def test_build_user_prompt_groups_by_source(self):
        from app.services.pulse_digest import _build_user_prompt

        msg1 = make_message(msg_id=1, source_id=1, text="From source 1")
        msg2 = make_message(msg_id=2, source_id=2, text="From source 2")
        source1 = make_source(source_id=1, title="Channel A")
        source2 = make_source(source_id=2, title="Channel B")

        result = _build_user_prompt([msg1, msg2], {1: source1, 2: source2})

        assert "Channel A" in result
        assert "Channel B" in result


# ── Items counter tests ────────────────────────────────────────────────────


class TestCountDigestItems:
    def test_count_bullet_dash(self):
        from app.services.pulse_digest import count_digest_items

        content = "## News\n- Item one\n- Item two\n- Item three"
        assert count_digest_items(content) == 3

    def test_count_bullet_asterisk(self):
        from app.services.pulse_digest import count_digest_items

        content = "## News\n* Item one\n* Item two"
        assert count_digest_items(content) == 2

    def test_count_bullet_unicode(self):
        from app.services.pulse_digest import count_digest_items

        content = "## News\n• Item one\n• Item two\n• Item three\n• Item four"
        assert count_digest_items(content) == 4

    def test_count_numbered_items(self):
        from app.services.pulse_digest import count_digest_items

        content = "## Top picks\n1. First\n2. Second\n3. Third"
        assert count_digest_items(content) == 3

    def test_count_mixed_items(self):
        from app.services.pulse_digest import count_digest_items

        content = "## News\n- Item A\n- Item B\n\n## Top picks\n1. First\n2. Second"
        assert count_digest_items(content) == 4

    def test_count_empty_content(self):
        from app.services.pulse_digest import count_digest_items

        assert count_digest_items("") == 0

    def test_count_no_bullets(self):
        from app.services.pulse_digest import count_digest_items

        content = "## Summary\nSome text without bullets\nAnother line"
        assert count_digest_items(content) == 0

    def test_count_ignores_headings(self):
        from app.services.pulse_digest import count_digest_items

        content = "## Section\n### Subsection\n- Real item"
        assert count_digest_items(content) == 1


# ── Category prompt selection tests ─────────────────────────────────────────


class TestCategoryPrompts:
    def test_all_categories_have_prompts(self):
        from app.services.pulse_digest import CATEGORY_PROMPTS

        assert "news" in CATEGORY_PROMPTS
        assert "jobs" in CATEGORY_PROMPTS
        assert "learning" in CATEGORY_PROMPTS

    def test_news_prompt_contains_key_instructions(self):
        from app.services.pulse_digest import NEWS_SYSTEM_PROMPT

        assert "subcategory" in NEWS_SYSTEM_PROMPT.lower()
        assert "markdown" in NEWS_SYSTEM_PROMPT.lower()

    def test_jobs_prompt_contains_relevance_instructions(self):
        from app.services.pulse_digest import JOBS_SYSTEM_PROMPT

        assert "relevance" in JOBS_SYSTEM_PROMPT.lower()
        assert "company" in JOBS_SYSTEM_PROMPT.lower()


# ── Digest generation service tests ─────────────────────────────────────────


class TestDigestGeneration:
    @pytest.mark.asyncio
    async def test_generate_digest_no_messages(self):
        from app.services.pulse_digest import generate_digest

        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        db.execute = AsyncMock(return_value=mock_result)

        mock_llm = AsyncMock()

        result = await generate_digest(db, user_id=1, llm_client=mock_llm)

        assert result is None
        mock_llm.generate.assert_not_called()

    @pytest.mark.asyncio
    async def test_generate_digest_with_messages(self):
        from app.services.pulse_digest import generate_digest

        messages = [
            make_message(msg_id=1, text="News article 1"),
            make_message(msg_id=2, text="News article 2"),
        ]
        source = make_source()

        db = AsyncMock()
        call_count = 0

        async def mock_execute(query):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                # Messages query
                result.scalars.return_value.all.return_value = messages
            else:
                # Sources query
                result.scalars.return_value.all.return_value = [source]
            return result

        db.execute = mock_execute

        mock_llm = AsyncMock()
        mock_llm.generate = AsyncMock(return_value="# Digest\n\n- News item 1\n- News item 2\n- News item 3")

        digest = await generate_digest(db, user_id=1, llm_client=mock_llm)

        assert digest is not None
        assert digest.content == "# Digest\n\n- News item 1\n- News item 2\n- News item 3"
        assert digest.message_count == 2
        assert digest.items_count == 3
        assert digest.user_id == 1
        # When no category is passed, effective_category is derived from messages
        assert digest.category == "news"
        mock_llm.generate.assert_called_once()

        # Check messages marked as in_digest
        for msg in messages:
            assert msg.status == "in_digest"

    @pytest.mark.asyncio
    async def test_generate_digest_llm_error(self):
        from app.services.pulse_digest import generate_digest

        messages = [make_message(msg_id=1)]
        source = make_source()

        db = AsyncMock()
        call_count = 0

        async def mock_execute(query):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                result.scalars.return_value.all.return_value = messages
            else:
                result.scalars.return_value.all.return_value = [source]
            return result

        db.execute = mock_execute

        mock_llm = AsyncMock()
        mock_llm.generate = AsyncMock(side_effect=Exception("LLM timeout"))

        with pytest.raises(RuntimeError, match="LLM generation failed"):
            await generate_digest(db, user_id=1, llm_client=mock_llm)

    @pytest.mark.asyncio
    async def test_generate_digest_with_category_filter(self):
        from app.services.pulse_digest import generate_digest

        messages = [
            make_message(msg_id=1, text="Job posting", category="jobs"),
        ]
        source = make_source(category="jobs")

        db = AsyncMock()
        call_count = 0

        async def mock_execute(query):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                result.scalars.return_value.all.return_value = messages
            else:
                result.scalars.return_value.all.return_value = [source]
            return result

        db.execute = mock_execute

        mock_llm = AsyncMock()
        mock_llm.generate = AsyncMock(return_value="# Jobs\n\nNew positions...")

        digest = await generate_digest(db, user_id=1, llm_client=mock_llm, category="jobs")

        assert digest is not None
        assert digest.category == "jobs"


# ── Schema tests ────────────────────────────────────────────────────────────


class TestSchemas:
    def test_digest_response_schema(self):
        from app.schemas.pulse_digest import DigestResponse

        data = DigestResponse(
            id=1,
            user_id=1,
            category="news",
            content="# Test digest",
            message_count=5,
            generated_at=datetime(2026, 3, 16, 12, 0, 0, tzinfo=timezone.utc),
            period_start=datetime(2026, 3, 15, 0, 0, 0, tzinfo=timezone.utc),
            period_end=datetime(2026, 3, 16, 0, 0, 0, tzinfo=timezone.utc),
        )
        assert data.id == 1
        assert data.category == "news"
        assert data.message_count == 5

    def test_digest_generate_request_optional_category(self):
        from app.schemas.pulse_digest import DigestGenerateRequest

        req = DigestGenerateRequest()
        assert req.category is None

        req2 = DigestGenerateRequest(category="jobs")
        assert req2.category == "jobs"

    def test_digest_list_response(self):
        from app.schemas.pulse_digest import DigestListResponse, DigestResponse

        resp = DigestListResponse(items=[], total=0)
        assert resp.total == 0
        assert resp.items == []


# ── API endpoint tests ──────────────────────────────────────────────────────


class TestDigestAPI:
    def setup_method(self):
        from app.core.deps import get_current_user
        from app.core.database import get_db

        self._user = make_user()

        # Mock DB session
        self._mock_db = AsyncMock()
        app.dependency_overrides[get_current_user] = lambda: self._user
        app.dependency_overrides[get_db] = lambda: self._mock_db

    def teardown_method(self):
        app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_list_digests_empty(self):
        # Count returns 0
        mock_count_result = MagicMock()
        mock_count_result.scalar.return_value = 0
        # Items returns empty
        mock_items_result = MagicMock()
        mock_items_result.scalars.return_value.all.return_value = []

        self._mock_db.execute = AsyncMock(
            side_effect=[mock_count_result, mock_items_result]
        )

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/pulse/digests/")

        assert response.status_code == 200
        data = response.json()
        assert data["items"] == []
        assert data["total"] == 0

    @pytest.mark.asyncio
    async def test_get_digest_not_found(self):
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        self._mock_db.execute = AsyncMock(return_value=mock_result)

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/pulse/digests/99999")

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_generate_no_llm_configured(self):
        # No UserSettings found
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        self._mock_db.execute = AsyncMock(return_value=mock_result)

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/pulse/digests/generate",
                json={},
            )

        assert response.status_code == 503


# ── Scheduler tests ─────────────────────────────────────────────────────────


class TestDigestScheduler:
    def test_schedule_user_digest_daily(self):
        from app.core.scheduler import schedule_user_digest, scheduler

        with patch.object(scheduler, "get_job", return_value=None), \
             patch.object(scheduler, "add_job") as mock_add:
            schedule_user_digest(user_id=1, schedule="daily", hour=9, minute=0)

            mock_add.assert_called_once()
            call_kwargs = mock_add.call_args
            assert call_kwargs[1]["id"] == "pulse_digest_user_1"
            assert call_kwargs[0][1] == "cron"

    def test_schedule_user_digest_weekly(self):
        from app.core.scheduler import schedule_user_digest, scheduler

        with patch.object(scheduler, "get_job", return_value=None), \
             patch.object(scheduler, "add_job") as mock_add:
            schedule_user_digest(
                user_id=1, schedule="weekly", hour=9, minute=0, day_of_week=1
            )

            mock_add.assert_called_once()
            call_kwargs = mock_add.call_args
            assert call_kwargs[1]["day_of_week"] == 1

    def test_schedule_user_digest_every_n_days(self):
        from app.core.scheduler import schedule_user_digest, scheduler

        with patch.object(scheduler, "get_job", return_value=None), \
             patch.object(scheduler, "add_job") as mock_add:
            schedule_user_digest(
                user_id=1, schedule="every_n_days", hour=9, minute=0, interval_days=3
            )

            mock_add.assert_called_once()
            call_kwargs = mock_add.call_args
            assert call_kwargs[0][1] == "interval"
            assert call_kwargs[1]["days"] == 3

    def test_remove_user_digest(self):
        from app.core.scheduler import remove_user_digest, scheduler

        mock_job = MagicMock()
        with patch.object(scheduler, "get_job", return_value=mock_job), \
             patch.object(scheduler, "remove_job") as mock_remove:
            remove_user_digest(user_id=1)

            mock_remove.assert_called_once_with("pulse_digest_user_1")

    def test_schedule_replaces_existing_job(self):
        from app.core.scheduler import schedule_user_digest, scheduler

        mock_existing = MagicMock()
        with patch.object(scheduler, "get_job", return_value=mock_existing), \
             patch.object(scheduler, "remove_job") as mock_remove, \
             patch.object(scheduler, "add_job"):
            schedule_user_digest(user_id=1, schedule="daily", hour=9, minute=0)

            mock_remove.assert_called_once_with("pulse_digest_user_1")


# ── Settings reschedule tests ───────────────────────────────────────────────


class TestSettingsReschedule:
    @pytest.mark.asyncio
    @patch("app.services.pulse_settings.schedule_user_digest")
    @patch("app.services.pulse_settings.schedule_user_polling")
    async def test_update_settings_reschedules_digest(
        self, mock_schedule_polling, mock_schedule_digest
    ):
        from app.services.pulse_settings import update_settings
        from app.schemas.pulse_settings import PulseSettingsUpdate

        # Mock existing settings
        mock_settings = PulseSettings()
        mock_settings.user_id = 1
        mock_settings.digest_schedule = "daily"
        mock_settings.digest_time = time(9, 0)
        mock_settings.digest_day = None
        mock_settings.digest_interval_days = None
        mock_settings.polling_interval_minutes = 60

        db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_settings
        db.execute = AsyncMock(return_value=mock_result)

        data = PulseSettingsUpdate(digest_schedule="weekly", digest_day=1)

        await update_settings(db, user_id=1, data=data)

        mock_schedule_digest.assert_called_once()
        mock_schedule_polling.assert_not_called()
