from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, restrict_demo
from app.models.user import User
from app.schemas.job import (
    JobCreate,
    JobResponse,
    JobStatusChange,
    JobTrackingUpdate,
    JobUpdate,
    KanbanCardResponse,
    KanbanResponse,
    LinkedTaskBrief,
    LinkedEventBrief,
    MatchResultResponse,
    StatusHistoryResponse,
)
from app.schemas.note import LinkedNoteBrief
from app.services import job as job_service
from app.services import job_task_link as jtl_service
from app.services import job_event_link as jel_service
from app.services import note_job_link as njl_service
from app.services import job_matching as match_service
from app.services.scraper import fetch_job_metadata

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


@router.post("/", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
async def create_job(
    data: JobCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    job = await job_service.create_job(db, data, current_user)
    return job


@router.get("/kanban", response_model=KanbanResponse)
async def get_kanban(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    buckets = await job_service.get_kanban(db, current_user)
    return {key: [KanbanCardResponse.model_validate(j) for j in jobs] for key, jobs in buckets.items()}


@router.get("/", response_model=list[JobResponse])
async def list_jobs(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    search: Optional[str] = Query(None),
    company: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    tags: Optional[str] = Query(None),
    sort_by: str = Query("created_at"),
    sort_order: str = Query("desc"),
):
    jobs = await job_service.list_jobs(
        db,
        current_user,
        search=search,
        company=company,
        source=source,
        status=status_filter,
        tags=tags,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    return jobs


@router.get("/{job_id}", response_model=JobResponse)
async def get_job(
    job_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    job = await job_service.get_job(db, job_id, current_user)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return job


@router.patch("/{job_id}", response_model=JobResponse)
async def update_job(
    job_id: int,
    data: JobUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    job = await job_service.update_job(db, job_id, data, current_user)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return job


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_job(
    job_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    deleted = await job_service.delete_job(db, job_id, current_user)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")


@router.patch("/{job_id}/status", response_model=JobResponse)
async def change_job_status(
    job_id: int,
    data: JobStatusChange,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    job = await job_service.change_status(db, job_id, data, current_user)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return job


@router.get("/{job_id}/history", response_model=list[StatusHistoryResponse])
async def get_job_history(
    job_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    history = await job_service.get_history(db, job_id, current_user)
    if history is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return history


@router.patch("/{job_id}/tracking", response_model=JobResponse)
async def update_job_tracking(
    job_id: int,
    data: JobTrackingUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    job = await job_service.update_tracking(db, job_id, data, current_user)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return job


class FetchDescriptionRequest(BaseModel):
    url: str


class FetchDescriptionResponse(BaseModel):
    title: str = ""
    company: str = ""
    location: str = ""
    description: str = ""


@router.post("/fetch-description", response_model=FetchDescriptionResponse)
async def fetch_description(
    data: FetchDescriptionRequest,
    current_user: User = Depends(get_current_user),
):
    """Fetch and extract job metadata from a URL (SSRF-protected)."""
    try:
        meta = await fetch_job_metadata(data.url)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except httpx.TimeoutException:
        raise HTTPException(status_code=status.HTTP_408_REQUEST_TIMEOUT, detail="Request timed out")
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Remote server returned {exc.response.status_code}",
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to fetch the URL",
        )
    return FetchDescriptionResponse(
        title=meta.title,
        company=meta.company,
        location=meta.location,
        description=meta.description,
    )


# ── AI Job Matching ──────────────────────────────────────────────────────────


@router.post("/{job_id}/match", response_model=MatchResultResponse)
async def run_job_match(
    job_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(restrict_demo),
):
    """Run AI matching for a job against the current user's profile."""
    try:
        result = await match_service.match_job(db, job_id, current_user)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)
        )
    return result


# ── Job-Task linking ─────────────────────────────────────────────────────────


@router.post("/{job_id}/link-task/{task_id}")
async def link_job_task(
    job_id: int,
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ok = await jtl_service.link_job_task(db, job_id, task_id, current_user)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job or task not found")
    return {"ok": True}


@router.delete("/{job_id}/link-task/{task_id}")
async def unlink_job_task(
    job_id: int,
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ok = await jtl_service.unlink_job_task(db, job_id, task_id, current_user)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return {"ok": True}


@router.get("/{job_id}/linked-tasks", response_model=list[LinkedTaskBrief])
async def get_job_linked_tasks(
    job_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tasks = await jtl_service.get_job_linked_tasks(db, job_id, current_user)
    if tasks is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return tasks


# ── Job-Event linking ────────────────────────────────────────────────────────


@router.post("/{job_id}/link-event/{event_id}")
async def link_job_event(
    job_id: int,
    event_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ok = await jel_service.link_job_event(db, job_id, event_id, current_user)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job or event not found")
    return {"ok": True}


@router.delete("/{job_id}/link-event/{event_id}")
async def unlink_job_event(
    job_id: int,
    event_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ok = await jel_service.unlink_job_event(db, job_id, event_id, current_user)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return {"ok": True}


@router.get("/{job_id}/linked-events", response_model=list[LinkedEventBrief])
async def get_job_linked_events(
    job_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    events = await jel_service.get_job_linked_events(db, job_id, current_user)
    if events is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return events


# ── Job-Note linking ────────────────────────────────────────────────────────


@router.get("/{job_id}/linked-notes", response_model=list[LinkedNoteBrief])
async def get_job_linked_notes(
    job_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notes = await njl_service.get_job_linked_notes(db, job_id, current_user)
    if notes is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return notes
