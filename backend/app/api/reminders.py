"""Reminder API endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, restrict_demo
from app.models.user import User
from app.schemas.reminder import (
    ReminderCreate,
    ReminderResponse,
    ReminderSnooze,
    ReminderUpdate,
)
from app.services import reminders as reminder_service

router = APIRouter(prefix="/api/reminders", tags=["reminders"])


def _to_response(r) -> ReminderResponse:
    resp = ReminderResponse.model_validate(r)
    if r.task_id and hasattr(r, "task") and r.task:
        resp.task_title = r.task.title
    return resp


@router.get("/", response_model=list[ReminderResponse])
async def list_reminders(
    include_done: bool = False,
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.models.reminder import ReminderStatus
    status_filter = ReminderStatus(status) if status else None
    reminders = await reminder_service.list_reminders(
        db, current_user, include_done=include_done, status_filter=status_filter
    )
    return [_to_response(r) for r in reminders]


@router.post("/", response_model=ReminderResponse, status_code=status.HTTP_201_CREATED)
async def create_reminder(
    data: ReminderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(restrict_demo),
):
    reminder = await reminder_service.create_reminder(
        db,
        data.title,
        data.remind_at,
        current_user,
        recurrence_rule=data.recurrence_rule,
        task_id=data.task_id,
    )
    return _to_response(reminder)


@router.patch("/{reminder_id}", response_model=ReminderResponse)
async def update_reminder(
    reminder_id: int,
    data: ReminderUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(restrict_demo),
):
    reminder = await reminder_service.update_reminder(
        db,
        reminder_id,
        current_user,
        **data.model_dump(exclude_unset=True),
    )
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")
    return _to_response(reminder)


@router.delete("/{reminder_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_reminder(
    reminder_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(restrict_demo),
):
    deleted = await reminder_service.delete_reminder(db, reminder_id, current_user)
    if not deleted:
        raise HTTPException(status_code=404, detail="Reminder not found")


@router.post("/{reminder_id}/done", response_model=ReminderResponse)
async def mark_done(
    reminder_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(restrict_demo),
):
    reminder = await reminder_service.mark_done(db, reminder_id, current_user)
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")
    return _to_response(reminder)


@router.post("/{reminder_id}/restore", response_model=ReminderResponse)
async def restore_reminder(
    reminder_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(restrict_demo),
):
    reminder = await reminder_service.restore_reminder(db, reminder_id, current_user)
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found or not completed")
    return _to_response(reminder)


@router.post("/{reminder_id}/snooze", response_model=ReminderResponse)
async def snooze_reminder(
    reminder_id: int,
    data: ReminderSnooze,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(restrict_demo),
):
    reminder = await reminder_service.snooze_reminder(
        db,
        reminder_id,
        current_user,
        data.minutes,
    )
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")
    return _to_response(reminder)
