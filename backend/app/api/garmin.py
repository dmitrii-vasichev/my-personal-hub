from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, restrict_demo
from app.models.user import User
from app.schemas.garmin import (
    GarminConnectRequest,
    GarminStatusResponse,
    GarminSyncIntervalRequest,
)
from app.services import garmin_auth

router = APIRouter(prefix="/api/vitals", tags=["vitals"])


@router.post("/connect", response_model=GarminStatusResponse)
async def connect_garmin(
    data: GarminConnectRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(restrict_demo),
):
    """Connect Garmin account with email/password."""
    await garmin_auth.connect(db, current_user.id, data.email, data.password)
    await db.commit()
    result = await garmin_auth.get_status(db, current_user.id)
    return result


@router.delete("/disconnect", status_code=status.HTTP_204_NO_CONTENT)
async def disconnect_garmin(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(restrict_demo),
):
    """Disconnect Garmin account. Keeps historical health data."""
    await garmin_auth.disconnect(db, current_user.id)
    await db.commit()


@router.get("/connection", response_model=GarminStatusResponse)
async def get_connection_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get Garmin connection status."""
    return await garmin_auth.get_status(db, current_user.id)


@router.patch("/sync-interval", response_model=GarminStatusResponse)
async def update_sync_interval(
    data: GarminSyncIntervalRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(restrict_demo),
):
    """Update Garmin sync interval."""
    await garmin_auth.update_sync_interval(db, current_user.id, data.interval_minutes)
    await db.commit()
    return await garmin_auth.get_status(db, current_user.id)
