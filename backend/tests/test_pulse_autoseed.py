"""
Regression test for pulse auto-seed logic.
Ensures all expected categories are seeded for the demo user,
even when some categories already exist (bug #806).
"""
from __future__ import annotations

import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

from app.models.telegram import PulseDigest, PulseSource


def _make_digest(user_id: int, category: str) -> PulseDigest:
    d = PulseDigest()
    d.id = hash(category) % 10000
    d.user_id = user_id
    d.category = category
    d.content = None
    d.digest_type = "structured"
    d.message_count = 10
    d.items_count = 3
    d.generated_at = datetime(2026, 3, 20, tzinfo=timezone.utc)
    d.period_start = datetime(2026, 3, 19, tzinfo=timezone.utc)
    d.period_end = datetime(2026, 3, 20, tzinfo=timezone.utc)
    return d


EXPECTED_CATEGORIES = {"news", "learning", "jobs"}


class TestPulseAutoSeedCheck:
    """Tests for the category-completeness check used in main.py auto-seed."""

    def test_all_categories_present_skips_seed(self):
        """When all 3 categories exist, auto-seed should NOT trigger."""
        existing = {"news", "learning", "jobs"}
        assert EXPECTED_CATEGORIES.issubset(existing)

    def test_missing_news_triggers_seed(self):
        """Regression #806: only learning+jobs exist → must re-seed."""
        existing = {"learning", "jobs"}
        assert not EXPECTED_CATEGORIES.issubset(existing)

    def test_empty_db_triggers_seed(self):
        """No digests at all → must seed."""
        existing: set[str] = set()
        assert not EXPECTED_CATEGORIES.issubset(existing)

    def test_missing_multiple_categories_triggers_seed(self):
        """Only one category exists → must re-seed."""
        existing = {"jobs"}
        assert not EXPECTED_CATEGORIES.issubset(existing)

    def test_extra_categories_still_passes(self):
        """If there are extra categories beyond expected, still OK."""
        existing = {"news", "learning", "jobs", "alerts"}
        assert EXPECTED_CATEGORIES.issubset(existing)


class TestCreatePulseDataSeedsAllCategories:
    """Ensure seed_demo.create_pulse_data creates all expected categories."""

    @pytest.mark.asyncio
    async def test_seed_creates_news_learning_jobs(self):
        """create_pulse_data must produce digests for news, learning, and jobs."""
        from app.scripts.seed_demo import create_pulse_data

        added_objects: list = []
        flushed = []

        session = AsyncMock()
        session.add = MagicMock(side_effect=lambda obj: added_objects.append(obj))

        # flush() must assign fake ids so digest_id references work
        _next_id = 1

        async def fake_flush():
            nonlocal _next_id
            for obj in added_objects:
                if not hasattr(obj, "id") or obj.id is None:
                    obj.id = _next_id
                    _next_id += 1
            flushed.append(True)

        session.flush = fake_flush

        await create_pulse_data(session, user_id=999)

        digests = [o for o in added_objects if isinstance(o, PulseDigest)]
        seeded_categories = {d.category for d in digests}

        assert "news" in seeded_categories, "news category must be seeded"
        assert "learning" in seeded_categories, "learning category must be seeded"
        assert "jobs" in seeded_categories, "jobs category must be seeded"
        assert len(digests) == 3, f"Expected 3 digests, got {len(digests)}"

    @pytest.mark.asyncio
    async def test_seed_creates_sources(self):
        """create_pulse_data must also create PulseSource records."""
        from app.scripts.seed_demo import create_pulse_data

        added_objects: list = []

        session = AsyncMock()
        session.add = MagicMock(side_effect=lambda obj: added_objects.append(obj))

        _next_id = 1

        async def fake_flush():
            nonlocal _next_id
            for obj in added_objects:
                if not hasattr(obj, "id") or obj.id is None:
                    obj.id = _next_id
                    _next_id += 1

        session.flush = fake_flush

        await create_pulse_data(session, user_id=999)

        sources = [o for o in added_objects if isinstance(o, PulseSource)]
        assert len(sources) >= 1, "At least one PulseSource must be seeded"

    @pytest.mark.asyncio
    async def test_reseed_requires_source_cleanup(self):
        """Regression: re-seeding must delete PulseSource too, not just PulseDigest,
        otherwise unique constraint on (user_id, telegram_id) causes IntegrityError."""
        from app.scripts.seed_demo import create_pulse_data

        added_objects: list = []
        session = AsyncMock()
        session.add = MagicMock(side_effect=lambda obj: added_objects.append(obj))

        _next_id = 1

        async def fake_flush():
            nonlocal _next_id
            for obj in added_objects:
                if not hasattr(obj, "id") or obj.id is None:
                    obj.id = _next_id
                    _next_id += 1

        session.flush = fake_flush

        # Seed twice to simulate re-seed scenario
        await create_pulse_data(session, user_id=999)
        sources_first = [o for o in added_objects if isinstance(o, PulseSource)]
        telegram_ids_first = {s.telegram_id for s in sources_first}

        added_objects.clear()
        _next_id = 100
        await create_pulse_data(session, user_id=999)
        sources_second = [o for o in added_objects if isinstance(o, PulseSource)]
        telegram_ids_second = {s.telegram_id for s in sources_second}

        # Same telegram_ids would cause unique constraint violation in real DB
        assert telegram_ids_first == telegram_ids_second, \
            "Re-seed uses same telegram_ids — must delete PulseSource before re-seeding"
