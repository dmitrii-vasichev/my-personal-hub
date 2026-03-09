"""
Dashboard API routes.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.services import dashboard

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/summary")
async def get_summary(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await dashboard.get_summary(db, user)
