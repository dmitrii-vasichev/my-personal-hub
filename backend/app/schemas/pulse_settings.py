from datetime import datetime, time
from typing import Optional

from pydantic import BaseModel, Field


class PulseSettingsResponse(BaseModel):
    id: int
    user_id: int
    polling_interval_minutes: int
    digest_schedule: str
    digest_time: time
    timezone: str
    digest_day: Optional[int] = None
    digest_interval_days: Optional[int] = None
    message_ttl_days: int
    poll_message_limit: int
    bot_token_set: bool = False
    bot_chat_id: Optional[int] = None
    notify_digest_ready: bool
    notify_urgent_jobs: bool
    prompt_news: Optional[str] = None
    prompt_jobs: Optional[str] = None
    prompt_learning: Optional[str] = None
    updated_at: datetime

    model_config = {"from_attributes": True}


class PulseSettingsUpdate(BaseModel):
    polling_interval_minutes: Optional[int] = None
    digest_schedule: Optional[str] = None
    digest_time: Optional[time] = None
    timezone: Optional[str] = None
    digest_day: Optional[int] = None
    digest_interval_days: Optional[int] = None
    message_ttl_days: Optional[int] = None
    poll_message_limit: Optional[int] = None
    bot_token: Optional[str] = None
    bot_chat_id: Optional[int] = None
    notify_digest_ready: Optional[bool] = None
    notify_urgent_jobs: Optional[bool] = None
    prompt_news: Optional[str] = Field(None, max_length=5000)
    prompt_jobs: Optional[str] = Field(None, max_length=5000)
    prompt_learning: Optional[str] = Field(None, max_length=5000)
