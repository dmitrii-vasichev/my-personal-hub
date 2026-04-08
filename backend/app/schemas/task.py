from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.models.task import TaskPriority, TaskSource, TaskStatus, UpdateType, Visibility
from app.schemas.tag import TagBrief


class ChecklistItem(BaseModel):
    id: str
    text: str
    completed: bool = False


class UserBrief(BaseModel):
    id: int
    display_name: str
    email: str

    model_config = {"from_attributes": True}


# ── Task schemas ─────────────────────────────────────────────────────────────


class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    status: TaskStatus = TaskStatus.new
    priority: TaskPriority = TaskPriority.medium
    deadline: Optional[datetime] = None
    reminder_at: Optional[datetime] = None
    reminder_floating: bool = False
    checklist: list[ChecklistItem] = []
    assignee_id: Optional[int] = None
    visibility: Visibility = Visibility.family
    tag_ids: list[int] = []


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    deadline: Optional[datetime] = None
    reminder_at: Optional[datetime] = None
    reminder_floating: Optional[bool] = None
    checklist: Optional[list[ChecklistItem]] = None
    assignee_id: Optional[int] = None
    visibility: Optional[Visibility] = None
    tag_ids: Optional[list[int]] = None


class LinkedEventBrief(BaseModel):
    id: int
    title: str
    start_time: datetime
    end_time: datetime

    model_config = {"from_attributes": True}


class TaskReorder(BaseModel):
    task_id: int
    after_task_id: Optional[int] = None
    before_task_id: Optional[int] = None


class TaskResponse(BaseModel):
    id: int
    user_id: int
    created_by_id: int
    assignee_id: Optional[int]
    title: str
    description: Optional[str]
    status: TaskStatus
    priority: TaskPriority
    checklist: list[dict]
    source: TaskSource
    visibility: Visibility
    deadline: Optional[datetime]
    reminder_at: Optional[datetime]
    reminder_floating: bool
    reminder_dismissed: bool
    completed_at: Optional[datetime]
    kanban_order: float = 0
    created_at: datetime
    updated_at: datetime

    creator: Optional[UserBrief] = None
    assignee: Optional[UserBrief] = None
    owner_name: Optional[str] = None
    linked_events: list[LinkedEventBrief] = []
    tags: list[TagBrief] = []

    model_config = {"from_attributes": True}


# ── TaskUpdate (timeline) schemas ────────────────────────────────────────────


class TaskUpdateCreate(BaseModel):
    type: UpdateType
    content: Optional[str] = None
    progress_percent: Optional[int] = None


class TaskUpdateResponse(BaseModel):
    id: int
    task_id: int
    author_id: int
    type: UpdateType
    content: Optional[str]
    old_status: Optional[str]
    new_status: Optional[str]
    progress_percent: Optional[int]
    created_at: datetime

    author: Optional[UserBrief] = None

    model_config = {"from_attributes": True}


# ── Kanban schema ─────────────────────────────────────────────────────────────


class KanbanBoard(BaseModel):
    backlog: list[TaskResponse] = []
    new: list[TaskResponse] = []
    in_progress: list[TaskResponse] = []
    review: list[TaskResponse] = []
    done: list[TaskResponse] = []
    cancelled: list[TaskResponse] = []
