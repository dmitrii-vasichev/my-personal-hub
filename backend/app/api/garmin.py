from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, restrict_demo
from app.models.garmin import (
    GarminConnection,
    VitalsActivity,
    VitalsDailyMetric,
    VitalsSleep,
)
from app.models.user import User
from app.schemas.garmin import (
    GarminConnectRequest,
    GarminStatusResponse,
    GarminSyncIntervalRequest,
    VitalsActivityResponse,
    VitalsDailyMetricResponse,
    VitalsDashboardSummaryResponse,
    VitalsSleepResponse,
    VitalsTodayResponse,
)
from app.services import garmin_auth

router = APIRouter(prefix="/api/vitals", tags=["vitals"])

# Dashboard endpoint uses different prefix
dashboard_router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


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


@router.post("/sync", response_model=GarminStatusResponse)
async def trigger_sync(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(restrict_demo),
):
    """Trigger manual Garmin data sync."""
    from app.services.garmin_sync import sync_user_data

    await sync_user_data(db, current_user.id)
    await db.commit()
    return await garmin_auth.get_status(db, current_user.id)


@router.get("/metrics", response_model=list[VitalsDailyMetricResponse])
async def get_metrics(
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get daily metrics for date range (default: last 7 days)."""
    today = date.today()
    if end_date is None:
        end_date = today
    if start_date is None:
        start_date = end_date - timedelta(days=7)

    result = await db.execute(
        select(VitalsDailyMetric)
        .where(
            VitalsDailyMetric.user_id == current_user.id,
            VitalsDailyMetric.date >= start_date,
            VitalsDailyMetric.date <= end_date,
        )
        .order_by(VitalsDailyMetric.date)
    )
    return list(result.scalars().all())


@router.get("/sleep", response_model=list[VitalsSleepResponse])
async def get_sleep(
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get sleep data for date range (default: last 7 days)."""
    today = date.today()
    if end_date is None:
        end_date = today
    if start_date is None:
        start_date = end_date - timedelta(days=7)

    result = await db.execute(
        select(VitalsSleep)
        .where(
            VitalsSleep.user_id == current_user.id,
            VitalsSleep.date >= start_date,
            VitalsSleep.date <= end_date,
        )
        .order_by(VitalsSleep.date)
    )
    return list(result.scalars().all())


@router.get("/activities", response_model=list[VitalsActivityResponse])
async def get_activities(
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get activities for date range with pagination."""
    today = date.today()
    if end_date is None:
        end_date = today
    if start_date is None:
        start_date = end_date - timedelta(days=30)

    result = await db.execute(
        select(VitalsActivity)
        .where(
            VitalsActivity.user_id == current_user.id,
            VitalsActivity.start_time >= start_date.isoformat(),
            VitalsActivity.start_time <= (end_date + timedelta(days=1)).isoformat(),
        )
        .order_by(VitalsActivity.start_time.desc())
        .offset(offset)
        .limit(limit)
    )
    return list(result.scalars().all())


@router.get("/today", response_model=VitalsTodayResponse)
async def get_today(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get today's vitals snapshot: metrics + sleep + recent activities."""
    today = date.today()

    metrics_result = await db.execute(
        select(VitalsDailyMetric).where(
            VitalsDailyMetric.user_id == current_user.id,
            VitalsDailyMetric.date == today,
        )
    )
    metrics = metrics_result.scalar_one_or_none()

    sleep_result = await db.execute(
        select(VitalsSleep).where(
            VitalsSleep.user_id == current_user.id,
            VitalsSleep.date == today,
        )
    )
    sleep = sleep_result.scalar_one_or_none()

    activities_result = await db.execute(
        select(VitalsActivity)
        .where(VitalsActivity.user_id == current_user.id)
        .order_by(VitalsActivity.start_time.desc())
        .limit(3)
    )
    activities = list(activities_result.scalars().all())

    return VitalsTodayResponse(
        metrics=metrics,
        sleep=sleep,
        recent_activities=activities,
    )


@dashboard_router.get("/vitals-summary", response_model=VitalsDashboardSummaryResponse)
async def get_vitals_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get compact vitals data for dashboard widget."""
    today = date.today()

    metrics_result = await db.execute(
        select(VitalsDailyMetric).where(
            VitalsDailyMetric.user_id == current_user.id,
            VitalsDailyMetric.date == today,
        )
    )
    metrics = metrics_result.scalar_one_or_none()

    sleep_result = await db.execute(
        select(VitalsSleep).where(
            VitalsSleep.user_id == current_user.id,
            VitalsSleep.date == today,
        )
    )
    sleep = sleep_result.scalar_one_or_none()

    conn_result = await db.execute(
        select(GarminConnection).where(
            GarminConnection.user_id == current_user.id
        )
    )
    conn = conn_result.scalar_one_or_none()

    return VitalsDashboardSummaryResponse(
        metrics=metrics,
        sleep=sleep,
        connected=conn is not None and conn.is_active,
        last_sync_at=conn.last_sync_at if conn else None,
    )
