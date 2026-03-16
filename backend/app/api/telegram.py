from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.telegram import (
    TelegramStartAuthRequest,
    TelegramStatusResponse,
    TelegramVerifyCodeRequest,
)
from app.services import telegram_auth

router = APIRouter(prefix="/api/pulse/telegram", tags=["telegram"])


@router.post("/start-auth")
async def start_auth(
    data: TelegramStartAuthRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
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
    current_user: User = Depends(get_current_user),
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
    current_user: User = Depends(get_current_user),
):
    return await telegram_auth.get_status(db, current_user)


@router.delete("/disconnect", status_code=204)
async def disconnect(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await telegram_auth.disconnect(db, current_user)
