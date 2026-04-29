from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, Field


class TaskLinkedReminderReviewItem(BaseModel):
    task_id: int
    task_title: str
    reminder_id: int
    reminder_title: str
    action_date: date | None
    remind_at: datetime | None
    is_urgent: bool
    recurrence_rule: str | None
    details: str | None
    checklist_count: int


class PreserveTaskLinkedRemindersRequest(BaseModel):
    reminder_ids: list[int] = Field(default_factory=list)


class PreserveTaskLinkedRemindersResponse(BaseModel):
    preserved_count: int
    reminder_ids: list[int]
