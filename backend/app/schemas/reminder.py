from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.models.reminder import ReminderStatus


class ReminderCreate(BaseModel):
    title: str
    remind_at: datetime
    details: Optional[str] = None
    checklist: list[dict] = []
    recurrence_rule: Optional[str] = None
    task_id: Optional[int] = None
    is_floating: bool = False
    is_urgent: bool = False


class ReminderUpdate(BaseModel):
    title: Optional[str] = None
    remind_at: Optional[datetime] = None
    details: Optional[str] = None
    checklist: Optional[list[dict]] = None
    recurrence_rule: Optional[str] = None
    is_floating: Optional[bool] = None
    is_urgent: Optional[bool] = None


class ReminderSnooze(BaseModel):
    minutes: int  # 15 or 60


class ReminderResponse(BaseModel):
    id: int
    user_id: int
    title: str
    details: Optional[str] = None
    checklist: list[dict] = []
    remind_at: datetime
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
