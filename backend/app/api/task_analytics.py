"""
Task analytics API routes.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.services import task_analytics

router = APIRouter(prefix="/api/task-analytics", tags=["task-analytics"])


@router.get("/status-distribution")
async def get_status_distribution(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await task_analytics.get_status_distribution(db, user)


@router.get("/priority-distribution")
async def get_priority_distribution(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await task_analytics.get_priority_distribution(db, user)


@router.get("/completion-rate")
async def get_completion_rate(
    weeks: int = 12,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await task_analytics.get_completion_rate(db, user, weeks=weeks)


@router.get("/overdue")
async def get_overdue(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await task_analytics.get_overdue(db, user)
