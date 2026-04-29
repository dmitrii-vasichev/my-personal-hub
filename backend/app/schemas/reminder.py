from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field, model_validator

from app.models.reminder import ReminderStatus
from app.schemas.action import ActionMode


class ReminderCreate(BaseModel):
    title: str
    action_date: Optional[date] = None
    remind_at: Optional[datetime] = None
    details: Optional[str] = None
    checklist: list[dict] = Field(default_factory=list)
    recurrence_rule: Optional[str] = None
    task_id: Optional[int] = None
    is_floating: bool = False
    is_urgent: bool = False

    @model_validator(mode="after")
    def normalize_legacy_floating(self) -> "ReminderCreate":
        if self.action_date is None and self.remind_at is not None:
            self.action_date = self.remind_at.date()
        if self.is_floating:
            self.remind_at = None
        return self


class ReminderUpdate(BaseModel):
    title: Optional[str] = None
    action_date: Optional[date] = None
    remind_at: Optional[datetime] = None
    details: Optional[str] = None
    checklist: Optional[list[dict]] = None
    recurrence_rule: Optional[str] = None
    is_floating: Optional[bool] = None
    is_urgent: Optional[bool] = None

    @model_validator(mode="after")
    def normalize_legacy_floating(self) -> "ReminderUpdate":
        if self.action_date is None and self.remind_at is not None:
            self.action_date = self.remind_at.date()
        if self.is_floating is True:
            self.remind_at = None
        return self


class ReminderSnooze(BaseModel):
    minutes: int  # 15 or 60


class ReminderResponse(BaseModel):
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

    # Derived field for frontend
    task_title: Optional[str] = None

    model_config = {"from_attributes": True}
