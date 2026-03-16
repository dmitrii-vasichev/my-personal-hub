from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
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
