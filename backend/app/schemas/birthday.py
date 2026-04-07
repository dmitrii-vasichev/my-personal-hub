from datetime import date, datetime, time
from typing import Optional

from pydantic import BaseModel


class BirthdayCreate(BaseModel):
    name: str
    birth_date: date
    advance_days: int = 3
    reminder_time: time = time(10, 0)


class BirthdayUpdate(BaseModel):
    name: Optional[str] = None
    birth_date: Optional[date] = None
    advance_days: Optional[int] = None
    reminder_time: Optional[time] = None


class BirthdayResponse(BaseModel):
    id: int
    user_id: int
    name: str
    birth_date: date
    advance_days: int
    reminder_time: time
    next_birthday: date  # computed: next upcoming birthday date
    days_until: int  # computed: days until next birthday
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
