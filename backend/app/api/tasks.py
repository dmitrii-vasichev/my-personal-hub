from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.task import (
    KanbanBoard,
    TaskCreate,
    TaskResponse,
    TaskUpdate,
    TaskUpdateCreate,
    TaskUpdateResponse,
)
from app.services import task as task_service
from app.services import task_reminders as reminder_service

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


@router.post("/", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    data: TaskCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = await task_service.create_task(db, data, current_user)
    return task


@router.get("/kanban", response_model=KanbanBoard)
async def get_kanban(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    search: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    assignee_id: Optional[int] = Query(None),
    deadline_before: Optional[datetime] = Query(None),
    deadline_after: Optional[datetime] = Query(None),
):
    board = await task_service.get_kanban_board(
        db,
        current_user,
        search=search,
        priority=priority,
        assignee_id=assignee_id,
        deadline_before=deadline_before,
        deadline_after=deadline_after,
    )
    return board


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
    )
    return tasks


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = await task_service.get_task(db, task_id, current_user)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return task


@router.patch("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: int,
    data: TaskUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = await task_service.update_task(db, task_id, data, current_user)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return task


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    deleted = await task_service.delete_task(db, task_id, current_user)
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
    return await reminder_service.get_due_reminders(db, current_user)


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
    return task
