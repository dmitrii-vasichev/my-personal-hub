from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.telegram import PulseSource
from app.models.user import User
from app.schemas.pulse_source import (
    PulseSourceCreate,
    PulseSourceResolveResponse,
    PulseSourceResponse,
    PulseSourceUpdate,
)
from app.services import pulse_source as source_service

router = APIRouter(prefix="/api/pulse/sources", tags=["pulse-sources"])


@router.get("/", response_model=list[PulseSourceResponse])
async def list_sources(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await source_service.list_sources(db, current_user.id)


@router.post("/", response_model=PulseSourceResponse, status_code=201)
async def create_source(
    data: PulseSourceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    source = await source_service.create_source(db, current_user.id, data)
    await db.commit()
    return source


@router.patch("/{source_id}", response_model=PulseSourceResponse)
async def update_source(
    source_id: int,
    data: PulseSourceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    source = await source_service.update_source(db, source_id, current_user.id, data)
    await db.commit()
    return source


@router.delete("/{source_id}", status_code=204)
async def delete_source(
    source_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await source_service.delete_source(db, source_id, current_user.id)
    await db.commit()


@router.get("/resolve", response_model=PulseSourceResolveResponse)
async def resolve_source(
    identifier: str = Query(..., description="Channel username or invite link"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await source_service.resolve_source(db, current_user, identifier)


@router.post("/poll")
async def trigger_poll(
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Trigger immediate polling for current user's sources."""
    # Rate limit: check if any source was polled in the last 5 minutes
    five_min_ago = datetime.now(timezone.utc) - timedelta(minutes=5)
    result = await db.execute(
        select(PulseSource).where(
            PulseSource.user_id == current_user.id,
            PulseSource.is_active.is_(True),
            PulseSource.last_polled_at > five_min_ago,
        )
    )
    if result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=429, detail="Polling was triggered recently. Wait 5 minutes."
        )

    # Count active sources
    sources_result = await db.execute(
        select(PulseSource).where(
            PulseSource.user_id == current_user.id,
            PulseSource.is_active.is_(True),
        )
    )
    sources = list(sources_result.scalars().all())

    if not sources:
        raise HTTPException(status_code=400, detail="No active sources to poll.")

    from app.services.pulse_scheduler import run_user_poll

    background_tasks.add_task(run_user_poll, current_user.id)

    return {
        "ok": True,
        "detail": "Polling started",
        "sources_count": len(sources),
    }
