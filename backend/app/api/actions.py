"""Actions API endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, restrict_demo
from app.models.reminder import ReminderStatus
from app.models.user import User
from app.schemas.action import (
    ActionCreate,
    ActionResponse,
    ActionSnooze,
    ActionUpdate,
)
from app.schemas.task_cleanup import (
    PreserveTaskLinkedRemindersRequest,
    PreserveTaskLinkedRemindersResponse,
    TaskLinkedReminderReviewItem,
)
from app.services import actions as action_service
from app.services import task_cleanup as task_cleanup_service

router = APIRouter(prefix="/api/actions", tags=["actions"])


def _to_response(action) -> ActionResponse:
    resp = ActionResponse.model_validate(action)
    if action.task_id and hasattr(action, "task") and action.task:
        resp.task_title = action.task.title
    return resp


@router.get("/", response_model=list[ActionResponse])
async def list_actions(
    include_done: bool = False,
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    status_filter = ReminderStatus(status) if status else None
    actions = await action_service.list_actions(
        db, current_user, include_done=include_done, status_filter=status_filter
    )
    return [_to_response(action) for action in actions]


@router.post("/", response_model=ActionResponse, status_code=status.HTTP_201_CREATED)
async def create_action(
    data: ActionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(restrict_demo),
):
    action = await action_service.create_action(
        db,
        title=data.title,
        user=current_user,
        action_date=data.action_date,
        remind_at=data.remind_at,
        recurrence_rule=data.recurrence_rule,
        task_id=data.task_id,
        is_urgent=data.is_urgent,
        details=data.details,
        checklist=data.checklist,
    )
    return _to_response(action)


@router.get(
    "/task-cleanup/review",
    response_model=list[TaskLinkedReminderReviewItem],
)
async def review_task_linked_reminders(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await task_cleanup_service.list_task_linked_reminder_review(
        db, current_user
    )


@router.post(
    "/task-cleanup/preserve",
    response_model=PreserveTaskLinkedRemindersResponse,
)
async def preserve_task_linked_reminders(
    data: PreserveTaskLinkedRemindersRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(restrict_demo),
):
    return await task_cleanup_service.preserve_task_linked_reminders(
        db, current_user, data.reminder_ids
    )


@router.patch("/{action_id}", response_model=ActionResponse)
async def update_action(
    action_id: int,
    data: ActionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(restrict_demo),
):
    action = await action_service.update_action(
        db,
        action_id,
        current_user,
        **data.model_dump(exclude_unset=True),
    )
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")
    return _to_response(action)


@router.delete("/{action_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_action(
    action_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(restrict_demo),
):
    deleted = await action_service.delete_action(db, action_id, current_user)
    if not deleted:
        raise HTTPException(status_code=404, detail="Action not found")


@router.post("/{action_id}/done", response_model=ActionResponse)
async def mark_done(
    action_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(restrict_demo),
):
    action = await action_service.mark_done(db, action_id, current_user)
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")
    return _to_response(action)


@router.post("/{action_id}/restore", response_model=ActionResponse)
async def restore_action(
    action_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(restrict_demo),
):
    action = await action_service.restore_action(db, action_id, current_user)
    if not action:
        raise HTTPException(status_code=404, detail="Action not found or not completed")
    return _to_response(action)


@router.post("/{action_id}/snooze", response_model=ActionResponse)
async def snooze_action(
    action_id: int,
    data: ActionSnooze,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(restrict_demo),
):
    action = await action_service.snooze_action(
        db, action_id, current_user, data.minutes
    )
    if not action:
        raise HTTPException(status_code=404, detail="Action not found")
    return _to_response(action)
