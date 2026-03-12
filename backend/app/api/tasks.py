from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.task import (
    KanbanBoard,
    LinkedEventBrief,
    TaskCreate,
    TaskReorder,
    TaskResponse,
    TaskUpdate,
    TaskUpdateCreate,
    TaskUpdateResponse,
)
from app.services.task import PermissionDeniedError
from app.schemas.note import LinkedNoteBrief
from app.schemas.tag import BulkTagRequest, BulkTagResponse
from app.services import tag as tag_service
from app.services import task as task_service
from app.services import task_event_link as link_service
from app.services import note_task_link as ntl_service
from app.services import task_reminders as reminder_service

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


def _task_response(task) -> TaskResponse:
    """Build TaskResponse with owner_name derived from loaded owner relationship."""
    resp = TaskResponse.model_validate(task)
    if hasattr(task, "owner") and task.owner is not None:
        resp.owner_name = task.owner.display_name
    return resp


@router.post("/", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    data: TaskCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = await task_service.create_task(db, data, current_user)
    return _task_response(task)


@router.get("/kanban", response_model=KanbanBoard)
async def get_kanban(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    search: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    assignee_id: Optional[int] = Query(None),
    deadline_before: Optional[datetime] = Query(None),
    deadline_after: Optional[datetime] = Query(None),
    tag_id: Optional[int] = Query(None),
):
    board = await task_service.get_kanban_board(
        db,
        current_user,
        search=search,
        priority=priority,
        assignee_id=assignee_id,
        deadline_before=deadline_before,
        deadline_after=deadline_after,
        tag_id=tag_id,
    )
    return {col: [_task_response(t) for t in tasks] for col, tasks in board.items()}


@router.post("/reorder", response_model=TaskResponse)
async def reorder_task(
    data: TaskReorder,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        task = await task_service.reorder_task(
            db, data.task_id, data.after_task_id, data.before_task_id, current_user
        )
    except task_service.PermissionDeniedError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return _task_response(task)


@router.post("/bulk-tag", response_model=BulkTagResponse)
async def bulk_tag_tasks(
    data: BulkTagRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    affected = await tag_service.bulk_tag(db, current_user.id, data)
    return BulkTagResponse(affected_tasks=affected)


@router.get("/", response_model=list[TaskResponse])
async def list_tasks(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    status_filter: Optional[str] = Query(None, alias="status"),
    priority: Optional[str] = Query(None),
    assignee_id: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    deadline_before: Optional[datetime] = Query(None),
    deadline_after: Optional[datetime] = Query(None),
    sort_by: str = Query("created_at"),
    sort_order: str = Query("desc"),
    tag_id: Optional[int] = Query(None),
):
    tasks = await task_service.list_tasks(
        db,
        current_user,
        status=status_filter,
        priority=priority,
        assignee_id=assignee_id,
        search=search,
        deadline_before=deadline_before,
        deadline_after=deadline_after,
        sort_by=sort_by,
        sort_order=sort_order,
        tag_id=tag_id,
    )
    return [_task_response(t) for t in tasks]


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = await task_service.get_task(db, task_id, current_user)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return _task_response(task)


@router.patch("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: int,
    data: TaskUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        task = await task_service.update_task(db, task_id, data, current_user)
    except PermissionDeniedError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return _task_response(task)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        deleted = await task_service.delete_task(db, task_id, current_user)
    except PermissionDeniedError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")


# ── Task updates (timeline) ───────────────────────────────────────────────────


@router.get("/{task_id}/updates", response_model=list[TaskUpdateResponse])
async def list_task_updates(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    updates = await task_service.list_task_updates(db, task_id, current_user)
    if updates is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return updates


@router.post(
    "/{task_id}/updates",
    response_model=TaskUpdateResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_task_update(
    task_id: int,
    data: TaskUpdateCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    update = await task_service.create_task_update(db, task_id, data, current_user)
    if update is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return update


# ── Reminders ─────────────────────────────────────────────────────────────────


@router.get("/reminders/due", response_model=list[TaskResponse])
async def get_due_reminders(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return tasks where reminder_at is in the past or within 15 min and not dismissed."""
    tasks = await reminder_service.get_due_reminders(db, current_user)
    return [_task_response(t) for t in tasks]


@router.post("/{task_id}/reminders/dismiss", response_model=TaskResponse)
async def dismiss_reminder(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark a task reminder as dismissed."""
    task = await reminder_service.dismiss_reminder(db, task_id, current_user)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return _task_response(task)


# ── Task-Event links ──────────────────────────────────────────────────────────


@router.post("/{task_id}/events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def link_task_to_event(
    task_id: int,
    event_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ok = await link_service.link_task_event(db, task_id, event_id, current_user)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task or event not found")


@router.delete("/{task_id}/events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unlink_task_from_event(
    task_id: int,
    event_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ok = await link_service.unlink_task_event(db, task_id, event_id, current_user)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")


@router.get("/{task_id}/events", response_model=list[LinkedEventBrief])
async def get_task_linked_events(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    events = await link_service.get_linked_events(db, task_id, current_user)
    if events is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return events


# ── Task-Note links ──────────────────────────────────────────────────────────


@router.get("/{task_id}/linked-notes", response_model=list[LinkedNoteBrief])
async def get_task_linked_notes(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notes = await ntl_service.get_task_linked_notes(db, task_id, current_user)
    if notes is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return notes
