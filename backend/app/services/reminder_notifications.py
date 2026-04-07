"""Reminder notification service — Telegram inline buttons, snooze escalation, anti-procrastination."""

from __future__ import annotations

import logging
from typing import Any

from telegram import Bot, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.error import TelegramError

logger = logging.getLogger(__name__)


def _build_keyboard(
    reminder_id: int,
    snooze_count: int,
    snooze_limit: int,
    hub_url: str = "",
) -> InlineKeyboardMarkup:
    """Build inline keyboard based on snooze count vs limit.

    When snooze_count >= snooze_limit the quick-snooze buttons are removed
    (anti-procrastination gate) and only "Done" + "Open in Hub" remain.
    """
    reminders_url = f"{hub_url}/reminders" if hub_url else ""

    if snooze_count >= snooze_limit:
        rows: list[list[InlineKeyboardButton]] = [
            [InlineKeyboardButton("Done", callback_data=f"rem_done_{reminder_id}")],
        ]
        if reminders_url:
            rows.append(
                [InlineKeyboardButton("Open in Hub", url=reminders_url)],
            )
        return InlineKeyboardMarkup(rows)

    rows = [
        [
            InlineKeyboardButton("15 min", callback_data=f"rem_snooze_15_{reminder_id}"),
            InlineKeyboardButton("1 hour", callback_data=f"rem_snooze_60_{reminder_id}"),
        ],
        [InlineKeyboardButton("Done", callback_data=f"rem_done_{reminder_id}")],
    ]
    return InlineKeyboardMarkup(rows)


def _format_message(title: str, snooze_count: int, snooze_limit: int, time_str: str) -> str:
    """Format notification message with snooze escalation indicators."""
    if snooze_count >= snooze_limit:
        prefix = f"\U0001f534 (snoozed {snooze_count}x)"
    elif snooze_count >= 3:
        prefix = f"\U0001f7e0 (snoozed {snooze_count}x)"
    else:
        prefix = "\U0001f514"

    text = f"{prefix} {title}\n\U0001f552 {time_str}"

    if snooze_count >= snooze_limit:
        text += "\n\u26a0\ufe0f Quick snooze disabled. Open Hub to reschedule."

    return text


async def send_reminder_notification(
    bot_token: str,
    chat_id: int,
    reminder_id: int,
    title: str,
    time_str: str,
    snooze_count: int,
    snooze_limit: int,
    hub_url: str = "",
) -> dict[str, Any]:
    """Send a reminder notification via Telegram with inline action buttons.

    Returns dict with keys: success (bool), message_id (int | None), error (str | None).
    """
    try:
        bot = Bot(token=bot_token)
        text = _format_message(title, snooze_count, snooze_limit, time_str)
        keyboard = _build_keyboard(reminder_id, snooze_count, snooze_limit, hub_url)

        msg = await bot.send_message(
            chat_id=chat_id,
            text=text,
            reply_markup=keyboard,
        )
        return {"success": True, "message_id": msg.message_id, "error": None}
    except TelegramError as e:
        logger.warning("Reminder notification failed: %s", e)
        return {"success": False, "message_id": None, "error": str(e)}
    except Exception as e:
        logger.error("Unexpected error sending reminder: %s", e)
        return {"success": False, "message_id": None, "error": str(e)}
