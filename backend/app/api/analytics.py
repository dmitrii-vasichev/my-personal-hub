"""
Analytics API routes.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.services import analytics

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/funnel")
async def get_funnel(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await analytics.get_funnel(db, user)


@router.get("/timeline")
async def get_timeline(
    weeks: int = 12,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await analytics.get_timeline(db, user, weeks=weeks)


@router.get("/skills")
async def get_skills(
    top_n: int = 20,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await analytics.get_skills_demand(db, user, top_n=top_n)


@router.get("/sources")
async def get_sources(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await analytics.get_sources(db, user)


@router.get("/summary")
async def get_summary(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await analytics.get_summary(db, user)
