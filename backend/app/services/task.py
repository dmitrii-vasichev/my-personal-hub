from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.task import Task, TaskStatus, TaskUpdate, UpdateType
from app.models.user import User, UserRole
from app.schemas.task import TaskCreate, TaskUpdate as TaskUpdateSchema, TaskUpdateCreate


def _can_access_task(task: Task, user: User) -> bool:
    """Check if user can read/write this task."""
    if user.role == UserRole.admin:
        return True
    return task.user_id == user.id or task.assignee_id == user.id


def _task_query_for_user(user: User):
    """Build base select for tasks visible to user."""
    q = (
        select(Task)
        .options(
            selectinload(Task.updates),
        )
    )
    if user.role != UserRole.admin:
        q = q.where(
            or_(Task.user_id == user.id, Task.assignee_id == user.id)
        )
    return q


async def _load_task_with_users(db: AsyncSession, task_id: int) -> Task | None:
    result = await db.execute(
        select(Task)
        .where(Task.id == task_id)
        .options(selectinload(Task.updates))
    )
    return result.scalar_one_or_none()


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
        checklist=[item.model_dump() for item in data.checklist],
        assignee_id=_resolve_assignee(data.assignee_id, current_user),
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
    if task is None or not _can_access_task(task, current_user):
        return None

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
    q = select(Task)

    # Access control
    if current_user.role != UserRole.admin:
        q = q.where(
            or_(Task.user_id == current_user.id, Task.assignee_id == current_user.id)
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
    return list(result.scalars().all())


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
    await db.refresh(update)
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
        .order_by(TaskUpdate.created_at.desc())
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
