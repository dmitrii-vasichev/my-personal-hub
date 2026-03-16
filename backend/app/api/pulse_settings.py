from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.pulse_settings import PulseSettingsResponse, PulseSettingsUpdate
from app.services import pulse_settings as settings_service

router = APIRouter(prefix="/api/pulse/settings", tags=["pulse-settings"])


@router.get("/", response_model=PulseSettingsResponse)
async def get_settings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await settings_service.get_settings(db, current_user.id)


@router.put("/", response_model=PulseSettingsResponse)
async def update_settings(
    data: PulseSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    settings = await settings_service.update_settings(db, current_user.id, data)
    await db.commit()
    return settings
