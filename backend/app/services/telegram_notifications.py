"""Telegram Bot API notification service for Pulse digests and urgent job alerts."""
from __future__ import annotations

import logging
from typing import Any

from telegram import Bot
from telegram.error import TelegramError

logger = logging.getLogger(__name__)


async def send_digest_notification(
    bot_token: str,
    chat_id: int,
    digest: Any,
) -> dict[str, Any]:
    """Send a digest-ready notification via Telegram Bot API."""
    try:
        bot = Bot(token=bot_token)
        categories = digest.category or "all"
        text = (
            f"\U0001f4ca Digest ready: {digest.message_count} messages.\n"
            f"Category: {categories}\n"
            f"Generated at: {digest.generated_at:%Y-%m-%d %H:%M UTC}"
        )
        await bot.send_message(chat_id=chat_id, text=text)
        return {"success": True, "error": None}
    except TelegramError as e:
        logger.warning("Digest notification failed: %s", e)
        return {"success": False, "error": str(e)}
    except Exception as e:
        logger.error("Unexpected error sending digest notification: %s", e)
        return {"success": False, "error": str(e)}


async def send_urgent_job_notification(
    bot_token: str,
    chat_id: int,
    message: Any,
    source_title: str = "",
) -> dict[str, Any]:
    """Send an urgent job match notification via Telegram Bot API."""
    try:
        bot = Bot(token=bot_token)
        preview = (message.text or "")[:200]
        relevance = int((message.ai_relevance or 0) * 100)
        text = (
            f"\U0001f525 Urgent job match!\n"
            f"{preview}\n"
            f"Source: {source_title}\n"
            f"Relevance: {relevance}%"
        )
        await bot.send_message(chat_id=chat_id, text=text)
        return {"success": True, "error": None}
    except TelegramError as e:
        logger.warning("Urgent job notification failed: %s", e)
        return {"success": False, "error": str(e)}
    except Exception as e:
        logger.error("Unexpected error sending urgent job notification: %s", e)
        return {"success": False, "error": str(e)}


async def send_task_reminder_notification(
    bot_token: str,
    chat_id: int,
    task_title: str,
    reminder_at: str,
) -> dict[str, Any]:
    """Send a task reminder notification via Telegram Bot API."""
    try:
        bot = Bot(token=bot_token)
        text = f"\u23f0 Reminder: {task_title}\nScheduled: {reminder_at}"
        await bot.send_message(chat_id=chat_id, text=text)
        return {"success": True, "error": None}
    except TelegramError as e:
        logger.warning("Task reminder notification failed: %s", e)
        return {"success": False, "error": str(e)}
    except Exception as e:
        logger.error("Unexpected error sending task reminder: %s", e)
        return {"success": False, "error": str(e)}


async def verify_bot_connection(
    bot_token: str,
    chat_id: int,
) -> dict[str, Any]:
    """Test bot connection by sending a test message."""
    try:
        bot = Bot(token=bot_token)
        await bot.send_message(
            chat_id=chat_id,
            text="\u2705 Pulse bot connected successfully! You will receive notifications here.",
        )
        return {"success": True, "error": None}
    except TelegramError as e:
        return {"success": False, "error": str(e)}
    except Exception as e:
        return {"success": False, "error": str(e)}
