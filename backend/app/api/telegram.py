import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from telegram import Bot
from telegram.error import TelegramError

from app.core.database import get_db
from app.core.deps import restrict_demo
from app.core.encryption import decrypt_value
from app.models.telegram import PulseSettings
from app.models.user import User
from app.schemas.telegram import (
    TelegramConfigStatusResponse,
    TelegramCredentialsSaveRequest,
    TelegramStartAuthRequest,
    TelegramStatusResponse,
    TelegramVerifyCodeRequest,
)
from app.services import reminders as reminder_service
from app.services import telegram_auth

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/pulse/telegram", tags=["telegram"])


@router.get("/config-status", response_model=TelegramConfigStatusResponse)
async def config_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(restrict_demo),
):
    """Check if Telegram API credentials are configured (no secrets exposed)."""
    return await telegram_auth.get_credentials_status(db, current_user)


@router.put("/credentials")
async def save_credentials(
    data: TelegramCredentialsSaveRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(restrict_demo),
):
    """Save Telegram API credentials (admin only). API hash is encrypted at rest."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    await telegram_auth.save_credentials(db, current_user, data.api_id, data.api_hash)
    return {"ok": True, "detail": "Credentials saved"}


@router.post("/start-auth")
async def start_auth(
    data: TelegramStartAuthRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(restrict_demo),
):
    try:
        result = await telegram_auth.start_auth(db, current_user, data.phone_number)
        return {"ok": True, "detail": "Verification code sent", **result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/verify-code", response_model=TelegramStatusResponse)
async def verify_code(
    data: TelegramVerifyCodeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(restrict_demo),
):
    try:
        result = await telegram_auth.verify_code(
            db, current_user, data.code, data.password
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/status", response_model=TelegramStatusResponse)
async def get_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(restrict_demo),
):
    return await telegram_auth.get_status(db, current_user)


@router.delete("/disconnect", status_code=204)
async def disconnect(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(restrict_demo),
):
    await telegram_auth.disconnect(db, current_user)


# ---------------------------------------------------------------------------
# Telegram callback webhook — handles inline button presses from reminders
# ---------------------------------------------------------------------------


async def _get_user_by_chat_id(
    db: AsyncSession, chat_id: int
) -> tuple[User | None, PulseSettings | None]:
    """Look up user and their PulseSettings by Telegram bot_chat_id."""
    result = await db.execute(
        select(PulseSettings).where(PulseSettings.bot_chat_id == chat_id)
    )
    ps = result.scalar_one_or_none()
    if not ps:
        return None, None

    user_result = await db.execute(select(User).where(User.id == ps.user_id))
    user = user_result.scalar_one_or_none()
    return user, ps


async def _answer_callback(
    bot_token: str, callback_id: str, text: str
) -> None:
    """Answer a Telegram callback query so the spinner disappears."""
    try:
        bot = Bot(token=bot_token)
        await bot.answer_callback_query(callback_query_id=callback_id, text=text)
    except TelegramError as e:
        logger.warning("Failed to answer callback query: %s", e)


@router.post("/reminder-callback")
async def handle_reminder_callback(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Handle Telegram inline button callbacks for reminders.

    Telegram sends a callback_query when a user taps an inline button.
    Callback data format:
      - rem_done_{reminder_id}
      - rem_snooze_{minutes}_{reminder_id}
    """
    try:
        body = await request.json()

        callback_query = body.get("callback_query")
        if not callback_query:
            return {"ok": True}

        data = callback_query.get("data", "")
        callback_id = callback_query.get("id")
        chat_id = callback_query["message"]["chat"]["id"]

        # Parse callback data
        parts = data.split("_")
        if len(parts) < 3 or parts[0] != "rem":
            return {"ok": True}

        action = parts[1]

        user, ps = await _get_user_by_chat_id(db, chat_id)
        if not user or not ps or not ps.bot_token:
            return {"ok": True}

        token = decrypt_value(ps.bot_token)

        if action == "done" and len(parts) == 3:
            reminder_id = int(parts[2])
            result = await reminder_service.mark_done(db, reminder_id, user)
            answer_text = "Done!" if result else "Reminder not found"
            await _answer_callback(token, callback_id, answer_text)

        elif action == "snooze" and len(parts) == 4:
            minutes = int(parts[2])
            reminder_id = int(parts[3])
            result = await reminder_service.snooze_reminder(
                db, reminder_id, user, minutes
            )
            answer_text = f"Snoozed {minutes} min" if result else "Reminder not found"
            await _answer_callback(token, callback_id, answer_text)

    except Exception:
        logger.exception("Error handling reminder callback")

    return {"ok": True}
