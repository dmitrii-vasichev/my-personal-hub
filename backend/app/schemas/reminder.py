from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.models.reminder import ReminderStatus


class ReminderCreate(BaseModel):
    title: str
    remind_at: datetime
    recurrence_rule: Optional[str] = None
    task_id: Optional[int] = None


class ReminderUpdate(BaseModel):
    title: Optional[str] = None
    remind_at: Optional[datetime] = None
    recurrence_rule: Optional[str] = None


class ReminderSnooze(BaseModel):
    minutes: int  # 15 or 60


class ReminderResponse(BaseModel):
    id: int
    user_id: int
    title: str
    remind_at: datetime
    status: ReminderStatus
    snoozed_until: Optional[datetime]
    recurrence_rule: Optional[str]
    snooze_count: int
    notification_sent_count: int
    task_id: Optional[int]
    created_at: datetime
    updated_at: datetime

    # Derived field for frontend
    task_title: Optional[str] = None

    model_config = {"from_attributes": True}
