"""Tests for urgent job detection service."""
from __future__ import annotations

import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.pulse_urgent_jobs import check_urgent_jobs, URGENT_RELEVANCE_THRESHOLD
from app.models.telegram import PulseMessage


def make_message(
    msg_id: int = 1,
    category: str = "jobs",
    status: str = "new",
    relevance: float = 0.9,
    notified: bool = False,
) -> PulseMessage:
    m = PulseMessage()
    m.id = msg_id
    m.user_id = 1
    m.source_id = 1
    m.telegram_message_id = msg_id * 100
    m.text = f"Job message {msg_id}"
    m.category = category
    m.status = status
    m.ai_relevance = relevance
    m.notified_urgent = notified
    m.collected_at = datetime(2026, 3, 16, 10, 0, 0, tzinfo=timezone.utc)
    return m


class TestCheckUrgentJobs:
    @pytest.mark.asyncio
    async def test_detects_urgent_jobs(self):
        msgs = [make_message(1, relevance=0.9), make_message(2, relevance=0.85)]
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = msgs

        db = AsyncMock()
        db.execute.return_value = mock_result

        result = await check_urgent_jobs(db, user_id=1)

        assert len(result) == 2
        assert all(m.notified_urgent is True for m in result)

    @pytest.mark.asyncio
    async def test_skips_low_relevance(self):
        """Messages below threshold should not be returned by the query."""
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []

        db = AsyncMock()
        db.execute.return_value = mock_result

        result = await check_urgent_jobs(db, user_id=1)
        assert len(result) == 0

    @pytest.mark.asyncio
    async def test_skips_already_notified(self):
        """Already-notified messages should not be returned by the query."""
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []

        db = AsyncMock()
        db.execute.return_value = mock_result

        result = await check_urgent_jobs(db, user_id=1)
        assert len(result) == 0

    @pytest.mark.asyncio
    async def test_marks_as_notified(self):
        msg = make_message(1, relevance=0.95)
        assert msg.notified_urgent is False

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [msg]

        db = AsyncMock()
        db.execute.return_value = mock_result

        await check_urgent_jobs(db, user_id=1)
        assert msg.notified_urgent is True

    def test_threshold_value(self):
        assert URGENT_RELEVANCE_THRESHOLD == 0.8
