from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User, UserRole
from app.schemas.settings import MemberSettingsResponse, SettingsResponse, SettingsUpdate
from app.services import settings as settings_service

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("/")
async def get_settings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    settings = await settings_service.get_or_create_settings(db, current_user)
    if current_user.role == UserRole.admin:
        return settings_service.to_response(settings)
    return settings_service.to_member_response(settings)


@router.put("/")
async def update_settings(
    data: SettingsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    settings = await settings_service.update_settings(db, current_user, data)
    if current_user.role == UserRole.admin:
        return settings_service.to_response(settings)
    return settings_service.to_member_response(settings)
