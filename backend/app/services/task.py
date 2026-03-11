from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.models.task import Task, TaskStatus, TaskUpdate, UpdateType, Visibility
from app.models.user import User, UserRole
from app.schemas.task import TaskCreate, TaskUpdate as TaskUpdateSchema, TaskUpdateCreate


class PermissionDeniedError(Exception):
    """Raised when user lacks permission to edit/delete a resource."""


def _can_access_task(task: Task, user: User) -> bool:
    """Check if user can read this task."""
    if user.role == UserRole.admin:
        return True
    return (
        task.user_id == user.id
        or task.assignee_id == user.id
        or task.visibility == Visibility.family
    )


def _can_edit_task(task: Task, user: User) -> bool:
    """Check if user can edit/delete this task."""
    if user.role == UserRole.admin:
        return True
    return task.user_id == user.id or task.assignee_id == user.id


def _task_query_for_user(user: User):
    """Build base select for tasks visible to user."""
    q = (
        select(Task)
        .options(
            selectinload(Task.updates),
            joinedload(Task.owner),
        )
    )
    if user.role != UserRole.admin:
        q = q.where(
            or_(
                Task.user_id == user.id,
                Task.assignee_id == user.id,
                Task.visibility == Visibility.family,
            )
        )
    return q


async def _load_task_with_users(db: AsyncSession, task_id: int) -> Task | None:
    result = await db.execute(
        select(Task)
        .where(Task.id == task_id)
        .options(selectinload(Task.updates), joinedload(Task.owner))
    )
    return result.unique().scalar_one_or_none()


async def create_task(
    db: AsyncSession,
    data: TaskCreate,
    current_user: User,
) -> Task:
    task = Task(
        user_id=current_user.id,
        created_by_id=current_user.id,
        title=data.title,
        description=data.description,
        priority=data.priority,
        deadline=data.deadline,
        reminder_at=data.reminder_at,
        checklist=[item.model_dump() for item in data.checklist],
        assignee_id=_resolve_assignee(data.assignee_id, current_user),
        visibility=data.visibility,
    )
    db.add(task)
    await db.flush()  # get task.id

    # Auto-create initial status update
    initial_update = TaskUpdate(
        task_id=task.id,
        author_id=current_user.id,
        type=UpdateType.status_change,
        old_status=None,
        new_status=TaskStatus.new.value,
        content="Task created",
    )
    db.add(initial_update)
    await db.commit()
    await db.refresh(task)
    return task


async def get_task(
    db: AsyncSession,
    task_id: int,
    current_user: User,
) -> Task | None:
    task = await _load_task_with_users(db, task_id)
    if task is None:
        return None
    if not _can_access_task(task, current_user):
        return None
    return task


async def update_task(
    db: AsyncSession,
    task_id: int,
    data: TaskUpdateSchema,
    current_user: User,
) -> Task | None:
    task = await _load_task_with_users(db, task_id)
    if task is None:
        return None
    if not _can_access_task(task, current_user):
        return None
    if not _can_edit_task(task, current_user):
        raise PermissionDeniedError("You can only edit your own or assigned tasks")

    old_status = task.status

    if data.title is not None:
        task.title = data.title
    if data.description is not None:
        task.description = data.description
    if data.priority is not None:
        task.priority = data.priority
    if data.deadline is not None:
        task.deadline = data.deadline
    if data.checklist is not None:
        task.checklist = [item.model_dump() for item in data.checklist]
    if data.visibility is not None:
        task.visibility = data.visibility
    if data.reminder_at is not None:
        task.reminder_at = data.reminder_at
        task.reminder_dismissed = False

    # Handle assignee change
    if data.assignee_id is not None:
        new_assignee_id = _resolve_assignee(data.assignee_id, current_user)
        if new_assignee_id != task.assignee_id:
            task.assignee_id = new_assignee_id
            db.add(TaskUpdate(
                task_id=task.id,
                author_id=current_user.id,
                type=UpdateType.status_change,
                content=f"Task assigned",
            ))

    # Handle status change
    if data.status is not None and data.status != old_status:
        task.status = data.status
        if data.status == TaskStatus.done:
            task.completed_at = datetime.now(timezone.utc)
        elif old_status == TaskStatus.done:
            task.completed_at = None

        db.add(TaskUpdate(
            task_id=task.id,
            author_id=current_user.id,
            type=UpdateType.status_change,
            old_status=old_status.value,
            new_status=data.status.value,
        ))

    task.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(task)
    return task


async def delete_task(
    db: AsyncSession,
    task_id: int,
    current_user: User,
) -> bool:
    task = await _load_task_with_users(db, task_id)
    if task is None or not _can_access_task(task, current_user):
        return False
    if not _can_edit_task(task, current_user):
        raise PermissionDeniedError("You can only delete your own or assigned tasks")
    await db.delete(task)
    await db.commit()
    return True


async def list_tasks(
    db: AsyncSession,
    current_user: User,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    assignee_id: Optional[int] = None,
    search: Optional[str] = None,
    deadline_before: Optional[datetime] = None,
    deadline_after: Optional[datetime] = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
) -> list[Task]:
    q = select(Task).options(joinedload(Task.owner))

    # Access control: own + assigned + family-visible
    if current_user.role != UserRole.admin:
        q = q.where(
            or_(
                Task.user_id == current_user.id,
                Task.assignee_id == current_user.id,
                Task.visibility == Visibility.family,
            )
        )

    if status:
        statuses = [s.strip() for s in status.split(",")]
        q = q.where(Task.status.in_(statuses))
    if priority:
        q = q.where(Task.priority == priority)
    if assignee_id is not None:
        q = q.where(Task.assignee_id == assignee_id)
    if search:
        pattern = f"%{search}%"
        q = q.where(
            or_(Task.title.ilike(pattern), Task.description.ilike(pattern))
        )
    if deadline_before:
        q = q.where(Task.deadline <= deadline_before)
    if deadline_after:
        q = q.where(Task.deadline >= deadline_after)

    # Sorting
    sort_col = getattr(Task, sort_by, Task.created_at)
    q = q.order_by(sort_col.desc() if sort_order == "desc" else sort_col.asc())

    result = await db.execute(q)
    return list(result.unique().scalars().all())


async def get_kanban_board(
    db: AsyncSession,
    current_user: User,
    **filter_kwargs,
) -> dict[str, list[Task]]:
    tasks = await list_tasks(db, current_user, sort_order="asc", **filter_kwargs)
    board: dict[str, list[Task]] = {
        "new": [],
        "in_progress": [],
        "review": [],
        "done": [],
        "cancelled": [],
    }
    for task in tasks:
        board[task.status.value].append(task)
    return board


# ── Task updates ──────────────────────────────────────────────────────────────


async def create_task_update(
    db: AsyncSession,
    task_id: int,
    data: TaskUpdateCreate,
    current_user: User,
) -> TaskUpdate | None:
    task = await _load_task_with_users(db, task_id)
    if task is None or not _can_access_task(task, current_user):
        return None

    update = TaskUpdate(
        task_id=task_id,
        author_id=current_user.id,
        type=data.type,
        content=data.content,
        progress_percent=data.progress_percent,
    )
    db.add(update)
    await db.commit()
    await db.refresh(update, attribute_names=["author"])
    return update


async def list_task_updates(
    db: AsyncSession,
    task_id: int,
    current_user: User,
) -> list[TaskUpdate] | None:
    task = await _load_task_with_users(db, task_id)
    if task is None or not _can_access_task(task, current_user):
        return None

    result = await db.execute(
        select(TaskUpdate)
        .where(TaskUpdate.task_id == task_id)
        .options(joinedload(TaskUpdate.author))
        .order_by(TaskUpdate.created_at.desc())
        .execution_options(populate_existing=True)
    )
    return list(result.scalars().all())


# ── Helpers ───────────────────────────────────────────────────────────────────


def _resolve_assignee(assignee_id: Optional[int], current_user: User) -> Optional[int]:
    """Enforce assignee rules: admin can set anyone, user can only self-assign."""
    if assignee_id is None:
        return None
    if current_user.role == UserRole.admin:
        return assignee_id
    # Regular user can only assign to themselves
    return current_user.id if assignee_id == current_user.id else None
