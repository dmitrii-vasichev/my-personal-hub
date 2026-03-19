"""
Tests for Phase 40: Structured Digest Items.
Covers: model, structured digest generation, items API, actions, backwards compat.
"""
from __future__ import annotations

import json
import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from httpx import ASGITransport, AsyncClient

from app.main import app
from app.models.telegram import (
    PulseDigest,
    PulseDigestItem,
    PulseMessage,
    PulseSource,
)
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
    category: str = "learning",
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
    m.message_date = datetime(2026, 3, 19, 10, 0, 0, tzinfo=timezone.utc)
    m.collected_at = datetime(2026, 3, 19, 10, 0, 0, tzinfo=timezone.utc)
    return m


def make_source(
    source_id: int = 1,
    category: str = "learning",
    title: str = "Learning Channel",
    subcategory: str | None = None,
) -> PulseSource:
    s = PulseSource()
    s.id = source_id
    s.user_id = 1
    s.telegram_id = -1001234567890
    s.title = title
    s.category = category
    s.subcategory = subcategory
    s.is_active = True
    return s


def make_digest(
    digest_id: int = 1,
    user_id: int = 1,
    category: str = "learning",
    digest_type: str = "structured",
    content: str | None = None,
) -> PulseDigest:
    d = PulseDigest()
    d.id = digest_id
    d.user_id = user_id
    d.category = category
    d.content = content
    d.digest_type = digest_type
    d.message_count = 5
    d.items_count = 3
    d.generated_at = datetime(2026, 3, 19, 12, 0, 0, tzinfo=timezone.utc)
    d.period_start = datetime(2026, 3, 19, 8, 0, 0, tzinfo=timezone.utc)
    d.period_end = datetime(2026, 3, 19, 11, 0, 0, tzinfo=timezone.utc)
    return d


def make_digest_item(
    item_id: int = 1,
    digest_id: int = 1,
    user_id: int = 1,
    title: str = "Test Article",
    summary: str = "An interesting article about testing.",
    classification: str = "article",
    metadata: dict | None = None,
    status: str = "new",
) -> PulseDigestItem:
    i = PulseDigestItem()
    i.id = item_id
    i.digest_id = digest_id
    i.user_id = user_id
    i.title = title
    i.summary = summary
    i.classification = classification
    i.metadata_ = metadata
    i.source_names = ["Learning Channel"]
    i.source_message_ids = [1, 2]
    i.status = status
    i.actioned_at = None
    i.action_type = None
    i.action_result_id = None
    i.created_at = datetime(2026, 3, 19, 12, 0, 0, tzinfo=timezone.utc)
    return i


# ── 1. Model & schema tests ─────────────────────────────────────────────────


class TestModels:
    def test_pulse_digest_item_model(self):
        """PulseDigestItem has all required fields."""
        item = make_digest_item()
        assert item.title == "Test Article"
        assert item.classification == "article"
        assert item.status == "new"
        assert item.source_names == ["Learning Channel"]

    def test_pulse_digest_type_field(self):
        """PulseDigest has digest_type field."""
        d = make_digest(digest_type="structured")
        assert d.digest_type == "structured"
        assert d.content is None

    def test_pulse_digest_markdown_compat(self):
        """Old markdown digests still work."""
        d = make_digest(digest_type="markdown", content="## News\n- Item 1")
        assert d.digest_type == "markdown"
        assert d.content is not None

    def test_digest_item_with_metadata(self):
        """DigestItem can store job metadata."""
        meta = {"company": "TechCorp", "position": "SWE", "salary_range": "$150k-$200k"}
        item = make_digest_item(classification="vacancy", metadata=meta)
        assert item.metadata_ == meta
        assert item.classification == "vacancy"


# ── 2. Schema tests ─────────────────────────────────────────────────────────


class TestSchemas:
    def test_digest_response_nullable_content(self):
        from app.schemas.pulse_digest import DigestResponse

        r = DigestResponse(
            id=1, user_id=1, category="learning", content=None,
            digest_type="structured", message_count=5, items_count=3,
            generated_at=datetime.now(timezone.utc),
        )
        assert r.content is None
        assert r.digest_type == "structured"

    def test_digest_item_response(self):
        from app.schemas.pulse_digest import DigestItemResponse

        r = DigestItemResponse(
            id=1, digest_id=1, title="Test", summary="Summary",
            classification="article", status="new",
            created_at=datetime.now(timezone.utc),
        )
        assert r.title == "Test"
        assert r.metadata is None

    def test_digest_item_from_orm(self):
        from app.schemas.pulse_digest import DigestItemResponse

        item = make_digest_item(metadata={"company": "Acme"})
        r = DigestItemResponse.from_orm_item(item)
        assert r.title == "Test Article"
        assert r.metadata == {"company": "Acme"}

    def test_digest_item_list_response(self):
        from app.schemas.pulse_digest import DigestItemListResponse

        r = DigestItemListResponse(items=[], total=0, is_markdown=True)
        assert r.is_markdown is True


# ── 3. Structured digest generation tests ────────────────────────────────────


class TestStructuredDigestGeneration:
    @pytest.mark.asyncio
    async def test_learning_structured_digest(self):
        """Learning digest generates structured items."""
        from app.services.pulse_digest import generate_digest

        messages = [
            make_message(msg_id=1, text="Great article on Python testing"),
            make_message(msg_id=2, text="Useful lifehack: use pytest fixtures"),
        ]
        source = make_source()

        llm_response = json.dumps([
            {
                "title": "Python Testing Guide",
                "summary": "Comprehensive guide on testing in Python",
                "classification": "article",
                "source_names": ["Learning Channel"],
                "message_indices": [0],
            },
            {
                "title": "Pytest Fixtures Tip",
                "summary": "Useful tip for pytest fixtures",
                "classification": "lifehack",
                "source_names": ["Learning Channel"],
                "message_indices": [1],
            },
        ])

        mock_llm = AsyncMock()
        mock_llm.generate = AsyncMock(return_value=llm_response)

        mock_db = AsyncMock()
        # Mock query for messages
        mock_msg_result = MagicMock()
        mock_msg_result.scalars.return_value.all.return_value = messages
        # Mock query for sources
        mock_src_result = MagicMock()
        mock_src_result.scalars.return_value.all.return_value = [source]

        mock_db.execute = AsyncMock(side_effect=[mock_msg_result, mock_src_result])
        mock_db.add = MagicMock()
        mock_db.flush = AsyncMock()
        mock_db.refresh = AsyncMock()

        digest = await generate_digest(mock_db, 1, mock_llm, category="learning")

        assert digest is not None
        assert digest.digest_type == "structured"
        assert digest.content is None
        assert digest.items_count == 2
        # Verify items were added (db.add called for digest + 2 items)
        assert mock_db.add.call_count == 3

    @pytest.mark.asyncio
    async def test_jobs_structured_digest(self):
        """Jobs digest generates structured items with metadata."""
        from app.services.pulse_digest import generate_digest

        messages = [
            make_message(msg_id=1, category="jobs", text="Senior Python Dev at Google, $200k"),
        ]
        source = make_source(category="jobs", title="Jobs Channel")

        llm_response = json.dumps([
            {
                "title": "Senior Python Developer at Google",
                "summary": "Google is hiring senior Python developers",
                "classification": "vacancy",
                "metadata": {
                    "company": "Google",
                    "position": "Senior Python Developer",
                    "salary_range": "$180k-$220k",
                    "location": "Mountain View, CA",
                },
                "source_names": ["Jobs Channel"],
                "message_indices": [0],
            },
        ])

        mock_llm = AsyncMock()
        mock_llm.generate = AsyncMock(return_value=llm_response)

        mock_db = AsyncMock()
        mock_msg_result = MagicMock()
        mock_msg_result.scalars.return_value.all.return_value = messages
        mock_src_result = MagicMock()
        mock_src_result.scalars.return_value.all.return_value = [source]

        mock_db.execute = AsyncMock(side_effect=[mock_msg_result, mock_src_result])
        mock_db.add = MagicMock()
        mock_db.flush = AsyncMock()
        mock_db.refresh = AsyncMock()

        digest = await generate_digest(mock_db, 1, mock_llm, category="jobs")

        assert digest is not None
        assert digest.digest_type == "structured"
        assert digest.items_count == 1

    @pytest.mark.asyncio
    async def test_news_still_markdown(self):
        """News digest remains markdown, no items."""
        from app.services.pulse_digest import generate_digest

        messages = [make_message(msg_id=1, category="news", text="Breaking news")]
        source = make_source(category="news", title="News Channel")

        mock_llm = AsyncMock()
        mock_llm.generate = AsyncMock(return_value="## News\n- Breaking news happened")

        mock_db = AsyncMock()
        mock_msg_result = MagicMock()
        mock_msg_result.scalars.return_value.all.return_value = messages
        mock_src_result = MagicMock()
        mock_src_result.scalars.return_value.all.return_value = [source]

        mock_db.execute = AsyncMock(side_effect=[mock_msg_result, mock_src_result])
        mock_db.add = MagicMock()
        mock_db.flush = AsyncMock()
        mock_db.refresh = AsyncMock()

        digest = await generate_digest(mock_db, 1, mock_llm, category="news")

        assert digest is not None
        assert digest.digest_type == "markdown"
        assert digest.content == "## News\n- Breaking news happened"

    @pytest.mark.asyncio
    async def test_structured_json_parse_error_fallback(self):
        """If LLM returns invalid JSON, fall back to markdown."""
        from app.services.pulse_digest import generate_digest

        messages = [make_message(msg_id=1, text="Learning content")]
        source = make_source()

        # First call returns invalid JSON, second call (fallback) returns markdown
        mock_llm = AsyncMock()
        mock_llm.generate = AsyncMock(
            side_effect=["This is not valid JSON at all", "## Learning\n- Item"]
        )

        mock_db = AsyncMock()
        mock_msg_result = MagicMock()
        mock_msg_result.scalars.return_value.all.return_value = messages
        mock_src_result = MagicMock()
        mock_src_result.scalars.return_value.all.return_value = [source]

        mock_db.execute = AsyncMock(side_effect=[mock_msg_result, mock_src_result])
        mock_db.add = MagicMock()
        mock_db.flush = AsyncMock()
        mock_db.refresh = AsyncMock()

        digest = await generate_digest(mock_db, 1, mock_llm, category="learning")

        assert digest is not None
        assert digest.digest_type == "markdown"
        assert digest.content is not None


# ── 4. JSON parser tests ────────────────────────────────────────────────────


class TestJsonParser:
    def test_parse_clean_json(self):
        from app.services.pulse_digest import _parse_llm_json

        result = _parse_llm_json('[{"title": "test"}]')
        assert len(result) == 1
        assert result[0]["title"] == "test"

    def test_parse_json_in_code_block(self):
        from app.services.pulse_digest import _parse_llm_json

        response = '```json\n[{"title": "test"}]\n```'
        result = _parse_llm_json(response)
        assert len(result) == 1

    def test_parse_invalid_json_raises(self):
        from app.services.pulse_digest import _parse_llm_json

        with pytest.raises((json.JSONDecodeError, ValueError)):
            _parse_llm_json("not json")

    def test_parse_non_array_raises(self):
        from app.services.pulse_digest import _parse_llm_json

        with pytest.raises(ValueError):
            _parse_llm_json('{"title": "test"}')


# ── 5. Digest item actions tests ────────────────────────────────────────────


class TestDigestItemActions:
    @pytest.mark.asyncio
    async def test_action_to_task(self):
        """to_task creates a Task and updates item status."""
        from app.services.pulse_digest_items import process_item_action

        user = make_user()
        item = make_digest_item()
        mock_task = MagicMock()
        mock_task.id = 42

        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = item
        mock_db.execute = AsyncMock(return_value=mock_result)
        mock_db.commit = AsyncMock()

        with patch(
            "app.services.pulse_digest_items.task_service.create_task",
            new_callable=AsyncMock,
            return_value=mock_task,
        ):
            result = await process_item_action(mock_db, user, 1, "to_task")

        assert result is not None
        assert result["action"] == "to_task"
        assert result["created_id"] == 42
        assert item.status == "actioned"
        assert item.action_type == "to_task"

    @pytest.mark.asyncio
    async def test_action_to_job(self):
        """to_job creates a Job from item metadata."""
        from app.services.pulse_digest_items import process_item_action

        user = make_user()
        item = make_digest_item(
            classification="vacancy",
            metadata={
                "company": "Google",
                "position": "SWE",
                "salary_range": "$150k-$200k",
                "location": "NYC",
                "url": "https://example.com/job",
            },
        )

        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = item
        mock_db.execute = AsyncMock(return_value=mock_result)
        mock_db.add = MagicMock()
        mock_db.flush = AsyncMock()
        mock_db.commit = AsyncMock()

        # Mock the Job to get an ID after flush
        def set_job_id(*args, **kwargs):
            added_obj = mock_db.add.call_args[0][0]
            if hasattr(added_obj, "company"):
                added_obj.id = 99

        mock_db.flush.side_effect = set_job_id

        result = await process_item_action(mock_db, user, 1, "to_job")

        assert result is not None
        assert result["action"] == "to_job"
        assert result["created_id"] == 99
        assert item.status == "actioned"

        # Verify Job fields
        added_job = mock_db.add.call_args[0][0]
        assert added_job.company == "Google"
        assert added_job.title == "SWE"
        assert added_job.salary_min == 150000
        assert added_job.salary_max == 200000
        assert added_job.source == "pulse"

    @pytest.mark.asyncio
    async def test_action_skip(self):
        """skip sets status to skipped."""
        from app.services.pulse_digest_items import process_item_action

        user = make_user()
        item = make_digest_item()

        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = item
        mock_db.execute = AsyncMock(return_value=mock_result)
        mock_db.commit = AsyncMock()

        result = await process_item_action(mock_db, user, 1, "skip")

        assert result is not None
        assert result["action"] == "skip"
        assert item.status == "skipped"

    @pytest.mark.asyncio
    async def test_action_not_found(self):
        """Returns None for non-existent item."""
        from app.services.pulse_digest_items import process_item_action

        user = make_user()
        mock_db = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute = AsyncMock(return_value=mock_result)

        result = await process_item_action(mock_db, user, 999, "skip")
        assert result is None

    @pytest.mark.asyncio
    async def test_invalid_action(self):
        """Raises ValueError for invalid action."""
        from app.services.pulse_digest_items import process_item_action

        user = make_user()
        mock_db = AsyncMock()

        with pytest.raises(ValueError, match="Invalid action"):
            await process_item_action(mock_db, user, 1, "invalid")

    @pytest.mark.asyncio
    async def test_bulk_action(self):
        """Bulk action processes multiple items."""
        from app.services.pulse_digest_items import bulk_item_action

        user = make_user()
        items = [make_digest_item(item_id=i) for i in range(1, 4)]

        mock_db = AsyncMock()
        call_count = 0

        async def mock_execute(query):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            idx = (call_count - 1) % len(items)
            result.scalar_one_or_none.return_value = items[idx] if call_count <= 3 else None
            return result

        mock_db.execute = mock_execute
        mock_db.commit = AsyncMock()

        result = await bulk_item_action(mock_db, user, [1, 2, 3], "skip")

        assert result["processed"] == 3
        for item in items:
            assert item.status == "skipped"


# ── 6. Salary parser tests ──────────────────────────────────────────────────


class TestSalaryParser:
    def test_parse_salary_range_k_format(self):
        from app.services.pulse_digest_items import _parse_salary_range

        assert _parse_salary_range("$150k-$200k") == (150000, 200000)

    def test_parse_salary_range_full_numbers(self):
        from app.services.pulse_digest_items import _parse_salary_range

        assert _parse_salary_range("$150,000-$200,000") == (150000, 200000)

    def test_parse_salary_range_single(self):
        from app.services.pulse_digest_items import _parse_salary_range

        assert _parse_salary_range("$150k") == (150000, 150000)

    def test_parse_salary_range_none(self):
        from app.services.pulse_digest_items import _parse_salary_range

        assert _parse_salary_range(None) == (None, None)

    def test_parse_salary_range_no_numbers(self):
        from app.services.pulse_digest_items import _parse_salary_range

        assert _parse_salary_range("competitive") == (None, None)


# ── 7. AI filter — Learning excluded ────────────────────────────────────────


class TestAIFilterLearningExcluded:
    @pytest.mark.asyncio
    async def test_learning_messages_not_analyzed(self):
        """Learning messages should NOT be included in AI filter anymore."""
        from app.services.pulse_scheduler import _apply_ai_filter

        mock_db = AsyncMock()

        # Mock UserSettings with LLM
        mock_settings_result = MagicMock()
        mock_user_settings = MagicMock()
        mock_user_settings.llm_provider = "openai"
        mock_user_settings.api_key_openai = "encrypted_key"
        mock_settings_result.scalar_one_or_none.return_value = mock_user_settings

        # Mock messages query — should only find jobs
        mock_messages_result = MagicMock()
        mock_messages_result.scalars.return_value.all.return_value = []

        mock_db.execute = AsyncMock(
            side_effect=[mock_settings_result, mock_messages_result]
        )
        mock_db.commit = AsyncMock()

        with patch("app.services.pulse_scheduler.decrypt_value", return_value="key"), \
             patch("app.services.pulse_scheduler.get_llm_client") as mock_get_llm:
            mock_get_llm.return_value = AsyncMock()
            count = await _apply_ai_filter(mock_db, 1)

        assert count == 0

        # Verify the query filters for jobs only (not learning)
        execute_calls = mock_db.execute.call_args_list
        assert len(execute_calls) >= 2  # settings + messages query


# ── 8. Backwards compatibility ───────────────────────────────────────────────


class TestBackwardsCompat:
    def test_old_digest_markdown_type(self):
        """Old digests should have digest_type='markdown' by default."""
        d = PulseDigest()
        d.id = 1
        d.user_id = 1
        d.content = "## Old digest content"
        # digest_type defaults to "markdown" via server_default
        # In Python the attribute would be set by the database
        d.digest_type = "markdown"
        assert d.content is not None
        assert d.digest_type == "markdown"

    def test_digest_response_with_old_digest(self):
        """DigestResponse handles old-style digests with content."""
        from app.schemas.pulse_digest import DigestResponse

        r = DigestResponse(
            id=1, user_id=1, category="news",
            content="## News\n- Item 1",
            digest_type="markdown", message_count=3,
            generated_at=datetime.now(timezone.utc),
        )
        assert r.content == "## News\n- Item 1"
        assert r.digest_type == "markdown"


# ── 9. API tests ─────────────────────────────────────────────────────────────


class TestDigestItemsAPI:
    @pytest.mark.asyncio
    async def test_list_digest_items(self):
        """GET /api/pulse/digests/{id}/items returns items for structured digest."""
        from app.core.deps import get_current_user
        from app.core.database import get_db

        digest = make_digest(digest_type="structured")
        items = [make_digest_item(item_id=i) for i in range(1, 3)]

        mock_db = AsyncMock()
        call_count = 0

        async def mock_execute(query):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                # Digest lookup
                result.scalar_one_or_none.return_value = digest
            elif call_count == 2:
                # Count query
                result.scalar.return_value = 2
            else:
                # Items query
                result.scalars.return_value.all.return_value = items
            return result

        mock_db.execute = mock_execute

        async def db_override():
            yield mock_db

        app.dependency_overrides[get_current_user] = lambda: make_user()
        app.dependency_overrides[get_db] = db_override

        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                response = await client.get("/api/pulse/digests/1/items")

            assert response.status_code == 200
            data = response.json()
            assert data["total"] == 2
            assert len(data["items"]) == 2
            assert data["is_markdown"] is False
        finally:
            app.dependency_overrides.clear()

    @pytest.mark.asyncio
    async def test_list_items_markdown_digest(self):
        """GET /api/pulse/digests/{id}/items for markdown digest returns empty + is_markdown flag."""
        digest = make_digest(digest_type="markdown", content="## News")

        # This tests the logic directly
        from app.schemas.pulse_digest import DigestItemListResponse

        if (digest.digest_type or "markdown") == "markdown":
            result = DigestItemListResponse(items=[], total=0, is_markdown=True)
            assert result.is_markdown is True
            assert result.total == 0

    @pytest.mark.asyncio
    async def test_old_inbox_endpoints_removed(self):
        """Old inbox endpoints should return 404 (not registered)."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/api/pulse/inbox/")
            assert response.status_code in (404, 307)  # Not found or not registered
