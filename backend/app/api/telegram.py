from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, restrict_demo
from app.models.user import User
from app.schemas.telegram import (
    TelegramConfigStatusResponse,
    TelegramCredentialsSaveRequest,
    TelegramStartAuthRequest,
    TelegramStatusResponse,
    TelegramVerifyCodeRequest,
)
from app.services import telegram_auth

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
