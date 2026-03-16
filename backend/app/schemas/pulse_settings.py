from datetime import datetime, time
from typing import Optional

from pydantic import BaseModel


class PulseSettingsResponse(BaseModel):
    id: int
    user_id: int
    polling_interval_minutes: int
    digest_schedule: str
    digest_time: time
    digest_day: Optional[int] = None
    digest_interval_days: Optional[int] = None
    message_ttl_days: int
    notify_digest_ready: bool
    notify_urgent_jobs: bool
    updated_at: datetime

    model_config = {"from_attributes": True}


class PulseSettingsUpdate(BaseModel):
    polling_interval_minutes: Optional[int] = None
    digest_schedule: Optional[str] = None
    digest_time: Optional[time] = None
    digest_day: Optional[int] = None
    digest_interval_days: Optional[int] = None
    message_ttl_days: Optional[int] = None
    notify_digest_ready: Optional[bool] = None
    notify_urgent_jobs: Optional[bool] = None
