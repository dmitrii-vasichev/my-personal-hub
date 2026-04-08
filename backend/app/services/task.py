from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.models.tag import TaskTag
from app.models.task import Task, TaskStatus, TaskUpdate, UpdateType, Visibility
from app.models.user import User, UserRole
from app.schemas.task import TaskCreate, TaskUpdate as TaskUpdateSchema, TaskUpdateCreate
from app.services.tag import sync_task_tags

logger = logging.getLogger(__name__)


class PermissionDeniedError(Exception):
    """Raised when user lacks permission to edit/delete a resource."""


def _is_demo_owned(task: Task) -> bool:
    """Check if task belongs to a demo user."""
    return task.owner is not None and task.owner.role == UserRole.demo


def _can_access_task(task: Task, user: User) -> bool:
    """Check if user can read this task."""
    if user.role == UserRole.demo:
        return task.user_id == user.id
    # Non-demo users never see demo user's data
    if _is_demo_owned(task):
        return False
    if user.role == UserRole.admin:
        return True
    if task.user_id == user.id or task.assignee_id == user.id:
        return True
    return task.visibility == Visibility.family


def _can_edit_task(task: Task, user: User) -> bool:
    """Check if user can edit/delete this task."""
    if user.role == UserRole.admin:
        return True
    return task.user_id == user.id or task.assignee_id == user.id


def _exclude_demo_owners(owner_id_col):
    """Exclude records owned by demo users."""
    demo_ids = select(User.id).where(User.role == UserRole.demo)
    return ~owner_id_col.in_(demo_ids)


def _task_query_for_user(user: User):
    """Build base select for tasks visible to user."""
    q = (
        select(Task)
        .options(
            selectinload(Task.updates),
            joinedload(Task.owner),
        )
    )
    if user.role == UserRole.demo:
        q = q.where(Task.user_id == user.id)
    elif user.role == UserRole.admin:
        q = q.where(_exclude_demo_owners(Task.user_id))
    else:
        q = q.where(
            or_(
                Task.user_id == user.id,
                Task.assignee_id == user.id,
                and_(
                    Task.visibility == Visibility.family,
                    _exclude_demo_owners(Task.user_id),
                ),
            )
        )
    return q


async def _load_task_with_users(db: AsyncSession, task_id: int) -> Task | None:
    result = await db.execute(
        select(Task)
        .where(Task.id == task_id)
        .options(
            selectinload(Task.updates),
            joinedload(Task.owner),
            selectinload(Task.tags),
        )
    )
    return result.unique().scalar_one_or_none()


async def _get_min_kanban_order(db: AsyncSession, status: str) -> float:
    """Get the minimum kanban_order for a given status column."""
    result = await db.execute(
        select(func.min(Task.kanban_order)).where(Task.status == status)
    )
    min_order = result.scalar()
    return (min_order - 1) if min_order is not None else 0


async def create_task(
    db: AsyncSession,
    data: TaskCreate,
    current_user: User,
) -> Task:
    # Place new task at top of the target status column
    initial_status = data.status if data.status else TaskStatus.new
    top_order = await _get_min_kanban_order(db, initial_status.value)
    task = Task(
        user_id=current_user.id,
        created_by_id=current_user.id,
        title=data.title,
        description=data.description,
        status=initial_status,
        priority=data.priority,
        deadline=data.deadline,
        reminder_at=data.reminder_at,
        reminder_floating=data.reminder_floating,
        checklist=[item.model_dump() for item in data.checklist],
        assignee_id=_resolve_assignee(data.assignee_id, current_user),
        visibility=data.visibility,
        kanban_order=top_order,
    )
    db.add(task)
    await db.flush()  # get task.id

    # Sync tags
    if data.tag_ids:
        await sync_task_tags(db, task.id, data.tag_ids, current_user.id)

    # Auto-create initial status update
    initial_update = TaskUpdate(
        task_id=task.id,
        author_id=current_user.id,
        type=UpdateType.status_change,
        old_status=None,
        new_status=initial_status.value,
        content="Task created",
    )
    db.add(initial_update)

    # Create linked Reminder record if reminder_at is set (before commit for atomicity)
    if data.reminder_at:
        await _sync_task_reminder(db, task, current_user)

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
    if "deadline" in data.model_fields_set:
        task.deadline = data.deadline
    if data.checklist is not None:
        task.checklist = [item.model_dump() for item in data.checklist]
    if data.visibility is not None:
        task.visibility = data.visibility
    reminder_at_changed = False
    if "reminder_at" in data.model_fields_set:
        task.reminder_at = data.reminder_at
        if data.reminder_at is not None:
            task.reminder_dismissed = False
            task.reminder_telegram_sent = False
        reminder_at_changed = True
    if data.reminder_floating is not None:
        task.reminder_floating = data.reminder_floating
        reminder_at_changed = True

    # Handle assignee change
    if data.assignee_id is not None:
        new_assignee_id = _resolve_assignee(data.assignee_id, current_user)
        if new_assignee_id != task.assignee_id:
            task.assignee_id = new_assignee_id
            db.add(TaskUpdate(
                task_id=task.id,
                author_id=current_user.id,
                type=UpdateType.status_change,
                content="Task assigned",
            ))

    # Handle status change
    if data.status is not None and data.status != old_status:
        task.status = data.status
        if data.status == TaskStatus.done:
            task.completed_at = datetime.now(timezone.utc)
        elif old_status == TaskStatus.done:
            task.completed_at = None

        # Place moved task at top of target column
        top_order = await _get_min_kanban_order(db, data.status.value)
        task.kanban_order = top_order

        db.add(TaskUpdate(
            task_id=task.id,
            author_id=current_user.id,
            type=UpdateType.status_change,
            old_status=old_status.value,
            new_status=data.status.value,
        ))

    # Sync tags if provided
    if data.tag_ids is not None:
        await sync_task_tags(db, task.id, data.tag_ids, current_user.id)

    task.updated_at = datetime.now(timezone.utc)

    # Sync linked Reminder record when reminder_at changes (before commit for atomicity)
    if reminder_at_changed:
        await _sync_task_reminder(db, task, current_user)

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
    tag_ids: Optional[str] = None,
) -> list[Task]:
    q = select(Task).options(joinedload(Task.owner), selectinload(Task.tags))

    # Access control: demo sees only own; admin/member never see demo data
    if current_user.role == UserRole.demo:
        q = q.where(Task.user_id == current_user.id)
    elif current_user.role == UserRole.admin:
        q = q.where(_exclude_demo_owners(Task.user_id))
    else:
        q = q.where(
            or_(
                Task.user_id == current_user.id,
                Task.assignee_id == current_user.id,
                and_(
                    Task.visibility == Visibility.family,
                    _exclude_demo_owners(Task.user_id),
                ),
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
    if tag_ids is not None:
        parts = [p.strip() for p in tag_ids.split(",") if p.strip()]
        include_untagged = "untagged" in parts
        numeric_ids = [int(p) for p in parts if p != "untagged"]
        conditions = []
        if numeric_ids:
            tagged_task_ids = select(TaskTag.task_id).where(TaskTag.tag_id.in_(numeric_ids))
            conditions.append(Task.id.in_(tagged_task_ids))
        if include_untagged:
            has_any_tag = select(TaskTag.task_id)
            conditions.append(~Task.id.in_(has_any_tag))
        if conditions:
            q = q.where(or_(*conditions))

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
    tasks = await list_tasks(
        db, current_user, sort_by="kanban_order", sort_order="asc", **filter_kwargs
    )
    board: dict[str, list[Task]] = {
        "backlog": [],
        "new": [],
        "in_progress": [],
        "review": [],
        "done": [],
        "cancelled": [],
    }
    for task in tasks:
        board[task.status.value].append(task)
    return board


async def reorder_task(
    db: AsyncSession,
    task_id: int,
    after_task_id: int | None,
    before_task_id: int | None,
    current_user: User,
) -> Task | None:
    """Move task to a new position within its column.

    Position is specified by the neighbouring tasks:
    - after_task_id: the task above (None = place first)
    - before_task_id: the task below (None = place last)
    """
    task = await _load_task_with_users(db, task_id)
    if task is None or not _can_access_task(task, current_user):
        return None
    if not _can_edit_task(task, current_user):
        raise PermissionDeniedError("You can only reorder your own or assigned tasks")

    after_order: float | None = None
    before_order: float | None = None

    if after_task_id is not None:
        after_task = await db.get(Task, after_task_id)
        if after_task:
            after_order = after_task.kanban_order

    if before_task_id is not None:
        before_task = await db.get(Task, before_task_id)
        if before_task:
            before_order = before_task.kanban_order

    if after_order is not None and before_order is not None:
        task.kanban_order = (after_order + before_order) / 2
    elif after_order is not None:
        task.kanban_order = after_order + 1
    elif before_order is not None:
        task.kanban_order = before_order - 1
    else:
        task.kanban_order = 0

    task.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(task)
    return task


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


async def _sync_task_reminder(
    db: AsyncSession,
    task: Task,
    user: User,
) -> None:
    """Sync Reminder record with task's reminder_at. Works within caller's transaction.

    This function intentionally does NOT commit — the caller is responsible
    for committing the transaction so that the task and reminder changes
    are persisted atomically.
    """
    from app.models.reminder import Reminder
    from sqlalchemy import select as sa_select

    # Find existing linked reminder
    result = await db.execute(
        sa_select(Reminder).where(
            Reminder.task_id == task.id, Reminder.user_id == user.id
        )
    )
    existing = result.scalar_one_or_none()

    if task.reminder_at:
        if existing:
            existing.remind_at = task.reminder_at
            existing.title = task.title
            existing.is_floating = task.reminder_floating
            existing.notification_sent_count = 0
            existing.snoozed_until = None
            existing.telegram_message_id = None
        else:
            reminder = Reminder(
                user_id=user.id,
                title=task.title,
                remind_at=task.reminder_at,
                is_floating=task.reminder_floating,
                task_id=task.id,
            )
            db.add(reminder)
    elif existing:
        # reminder_at was cleared — remove linked reminder
        await db.delete(existing)
