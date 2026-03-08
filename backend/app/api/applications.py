from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.application import (
    ApplicationCreate,
    ApplicationResponse,
    ApplicationStatusChange,
    ApplicationUpdate,
    KanbanCardResponse,
    KanbanResponse,
    StatusHistoryResponse,
)
from app.services import application as application_service
from app.services.application import DuplicateApplicationError

router = APIRouter(prefix="/api/applications", tags=["applications"])


@router.post("/", response_model=ApplicationResponse, status_code=status.HTTP_201_CREATED)
async def create_application(
    data: ApplicationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        result = await application_service.create_application(db, data, current_user)
    except DuplicateApplicationError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Application already exists for this job")
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return result


@router.get("/kanban", response_model=KanbanResponse)
async def get_kanban(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    buckets = await application_service.get_kanban(db, current_user)
    # Validate each bucket through KanbanCardResponse
    return {key: [KanbanCardResponse.model_validate(app) for app in apps] for key, apps in buckets.items()}


@router.get("/", response_model=list[ApplicationResponse])
async def list_applications(
    status: Optional[str] = Query(None, description="Comma-separated status values"),
    search: Optional[str] = Query(None, description="Search in job title and company"),
    sort_by: str = Query("created_at", description="Field to sort by"),
    sort_order: str = Query("desc", description="Sort direction: asc or desc"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    applications = await application_service.list_applications(
        db,
        current_user,
        status=status,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    return applications


@router.get("/{application_id}", response_model=ApplicationResponse)
async def get_application(
    application_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    application = await application_service.get_application(db, application_id, current_user)
    if application is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Application not found"
        )
    return application


@router.patch("/{application_id}", response_model=ApplicationResponse)
async def update_application(
    application_id: int,
    data: ApplicationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    application = await application_service.update_application(
        db, application_id, data, current_user
    )
    if application is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Application not found"
        )
    return application


@router.delete("/{application_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_application(
    application_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    deleted = await application_service.delete_application(db, application_id, current_user)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Application not found"
        )


@router.patch("/{application_id}/status", response_model=ApplicationResponse)
async def change_application_status(
    application_id: int,
    data: ApplicationStatusChange,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    application = await application_service.change_status(
        db, application_id, data, current_user
    )
    if application is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Application not found"
        )
    return application


@router.get("/{application_id}/history", response_model=list[StatusHistoryResponse])
async def get_application_history(
    application_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    history = await application_service.get_history(db, application_id, current_user)
    if history is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Application not found"
        )
    return history
