"""Telegram Mini App API — auth via initData."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.services.telegram_miniapp import MiniAppAuthError, authenticate_miniapp_user

router = APIRouter(prefix="/api/miniapp", tags=["miniapp"])


class MiniAppAuthRequest(BaseModel):
    init_data: str


class MiniAppAuthResponse(BaseModel):
    token: str
    user_id: int
    display_name: str


@router.post("/auth", response_model=MiniAppAuthResponse)
async def miniapp_auth(
    body: MiniAppAuthRequest,
    db: AsyncSession = Depends(get_db),
):
    """Authenticate a Telegram Mini App user via initData.

    Returns a JWT token for subsequent API calls.
    """
    try:
        user, token = await authenticate_miniapp_user(db, body.init_data)
    except MiniAppAuthError as e:
        raise HTTPException(status_code=401, detail=str(e))

    return MiniAppAuthResponse(
        token=token,
        user_id=user.id,
        display_name=user.display_name,
    )
