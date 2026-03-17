from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.encryption import decrypt_value, encrypt_value
from app.models.user import User
from app.schemas.pulse_settings import PulseSettingsResponse, PulseSettingsUpdate
from app.services import pulse_settings as settings_service
from app.services.telegram_notifications import verify_bot_connection

router = APIRouter(prefix="/api/pulse/settings", tags=["pulse-settings"])


def _to_response(settings) -> dict:
    """Convert PulseSettings model to response dict with bot_token_set computed."""
    return {
        "id": settings.id,
        "user_id": settings.user_id,
        "polling_interval_minutes": settings.polling_interval_minutes,
        "digest_schedule": settings.digest_schedule,
        "digest_time": settings.digest_time,
        "digest_day": settings.digest_day,
        "digest_interval_days": settings.digest_interval_days,
        "message_ttl_days": settings.message_ttl_days,
        "poll_message_limit": settings.poll_message_limit,
        "bot_token_set": bool(settings.bot_token),
        "bot_chat_id": settings.bot_chat_id,
        "notify_digest_ready": settings.notify_digest_ready,
        "notify_urgent_jobs": settings.notify_urgent_jobs,
        "prompt_news": settings.prompt_news,
        "prompt_jobs": settings.prompt_jobs,
        "prompt_learning": settings.prompt_learning,
        "updated_at": settings.updated_at,
    }


@router.get("/prompts/defaults")
async def get_prompt_defaults(current_user: User = Depends(get_current_user)):
    """Return default hardcoded prompts for all categories."""
    from app.services.pulse_digest import CATEGORY_PROMPTS

    return {
        "news": CATEGORY_PROMPTS.get("news", ""),
        "jobs": CATEGORY_PROMPTS.get("jobs", ""),
        "learning": CATEGORY_PROMPTS.get("learning", ""),
    }


@router.get("/", response_model=PulseSettingsResponse)
async def get_settings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    settings = await settings_service.get_settings(db, current_user.id)
    return _to_response(settings)


@router.put("/", response_model=PulseSettingsResponse)
async def update_settings(
    data: PulseSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Encrypt bot_token before saving
    if data.bot_token is not None:
        data.bot_token = encrypt_value(data.bot_token)
    settings = await settings_service.update_settings(db, current_user.id, data)
    await db.commit()
    return _to_response(settings)


@router.post("/test-bot")
async def test_bot(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Test bot connection by sending a test message."""
    settings = await settings_service.get_settings(db, current_user.id)
    if not settings.bot_token or not settings.bot_chat_id:
        return {"success": False, "error": "Bot token and chat ID must be configured first"}

    token = decrypt_value(settings.bot_token)
    result = await verify_bot_connection(token, settings.bot_chat_id)
    return result
