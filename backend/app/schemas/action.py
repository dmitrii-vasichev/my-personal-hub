from __future__ import annotations

from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator

from app.models.reminder import ReminderStatus


ActionMode = Literal["inbox", "anytime", "scheduled"]


class ActionCreate(BaseModel):
    title: str
    action_date: Optional[date] = None
    remind_at: Optional[datetime] = None
    details: Optional[str] = None
    checklist: list[dict] = Field(default_factory=list)
    recurrence_rule: Optional[str] = None
    task_id: Optional[int] = None
    is_urgent: bool = False

    @model_validator(mode="after")
    def derive_action_date(self) -> "ActionCreate":
        if self.action_date is None and self.remind_at is not None:
            self.action_date = self.remind_at.date()
        return self


class ActionUpdate(BaseModel):
    title: Optional[str] = None
    action_date: Optional[date] = None
    remind_at: Optional[datetime] = None
    details: Optional[str] = None
    checklist: Optional[list[dict]] = None
    recurrence_rule: Optional[str] = None
    is_urgent: Optional[bool] = None

    @model_validator(mode="after")
    def derive_action_date(self) -> "ActionUpdate":
        if self.action_date is None and self.remind_at is not None:
            self.action_date = self.remind_at.date()
        return self


class ActionSnooze(BaseModel):
    minutes: int


class ActionResponse(BaseModel):
    id: int
    user_id: int
    title: str
    details: Optional[str] = None
    checklist: list[dict] = Field(default_factory=list)
    action_date: Optional[date] = None
    remind_at: Optional[datetime] = None
    mode: ActionMode
    status: ReminderStatus
    snoozed_until: Optional[datetime]
    recurrence_rule: Optional[str]
    snooze_count: int
    notification_sent_count: int
    task_id: Optional[int]
    completed_at: Optional[datetime]
    is_floating: bool
    is_urgent: bool
    created_at: datetime
    updated_at: datetime
    task_title: Optional[str] = None

    model_config = {"from_attributes": True}
