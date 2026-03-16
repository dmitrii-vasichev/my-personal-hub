"""Tests for Telegram bot notification service."""
from __future__ import annotations

import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.telegram_notifications import (
    send_digest_notification,
    send_urgent_job_notification,
    verify_bot_connection,
)


def make_digest(msg_count: int = 10, category: str = "news") -> MagicMock:
    d = MagicMock()
    d.message_count = msg_count
    d.category = category
    d.generated_at = datetime(2026, 3, 16, 12, 0, 0, tzinfo=timezone.utc)
    return d


def make_message(text: str = "Senior Python Developer needed", relevance: float = 0.9) -> MagicMock:
    m = MagicMock()
    m.text = text
    m.ai_relevance = relevance
    return m


class TestSendDigestNotification:
    @pytest.mark.asyncio
    async def test_success(self):
        digest = make_digest()
        with patch("app.services.telegram_notifications.Bot") as MockBot:
            bot_instance = AsyncMock()
            MockBot.return_value = bot_instance
            result = await send_digest_notification("token123", 12345, digest)

        assert result["success"] is True
        assert result["error"] is None
        bot_instance.send_message.assert_awaited_once()
        call_kwargs = bot_instance.send_message.call_args
        assert "12345" == str(call_kwargs.kwargs["chat_id"]) or call_kwargs.kwargs["chat_id"] == 12345

    @pytest.mark.asyncio
    async def test_invalid_token(self):
        from telegram.error import TelegramError

        digest = make_digest()
        with patch("app.services.telegram_notifications.Bot") as MockBot:
            bot_instance = AsyncMock()
            bot_instance.send_message.side_effect = TelegramError("Unauthorized")
            MockBot.return_value = bot_instance
            result = await send_digest_notification("bad_token", 12345, digest)

        assert result["success"] is False
        assert "Unauthorized" in result["error"]

    @pytest.mark.asyncio
    async def test_network_error(self):
        digest = make_digest()
        with patch("app.services.telegram_notifications.Bot") as MockBot:
            bot_instance = AsyncMock()
            bot_instance.send_message.side_effect = Exception("Connection timeout")
            MockBot.return_value = bot_instance
            result = await send_digest_notification("token123", 12345, digest)

        assert result["success"] is False
        assert "Connection timeout" in result["error"]


class TestSendUrgentJobNotification:
    @pytest.mark.asyncio
    async def test_success(self):
        msg = make_message()
        with patch("app.services.telegram_notifications.Bot") as MockBot:
            bot_instance = AsyncMock()
            MockBot.return_value = bot_instance
            result = await send_urgent_job_notification("token123", 12345, msg, "Dev Jobs Channel")

        assert result["success"] is True
        assert result["error"] is None
        text_sent = bot_instance.send_message.call_args.kwargs["text"]
        assert "Urgent job match" in text_sent
        assert "Dev Jobs Channel" in text_sent
        assert "90%" in text_sent

    @pytest.mark.asyncio
    async def test_error(self):
        from telegram.error import TelegramError

        msg = make_message()
        with patch("app.services.telegram_notifications.Bot") as MockBot:
            bot_instance = AsyncMock()
            bot_instance.send_message.side_effect = TelegramError("Chat not found")
            MockBot.return_value = bot_instance
            result = await send_urgent_job_notification("token123", 99999, msg, "Source")

        assert result["success"] is False
        assert "Chat not found" in result["error"]


class TestBotConnection:
    @pytest.mark.asyncio
    async def test_success(self):
        with patch("app.services.telegram_notifications.Bot") as MockBot:
            bot_instance = AsyncMock()
            MockBot.return_value = bot_instance
            result = await verify_bot_connection("token123", 12345)

        assert result["success"] is True
        assert result["error"] is None
        bot_instance.send_message.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_failure(self):
        from telegram.error import TelegramError

        with patch("app.services.telegram_notifications.Bot") as MockBot:
            bot_instance = AsyncMock()
            bot_instance.send_message.side_effect = TelegramError("Invalid token")
            MockBot.return_value = bot_instance
            result = await verify_bot_connection("bad_token", 12345)

        assert result["success"] is False
        assert "Invalid token" in result["error"]
