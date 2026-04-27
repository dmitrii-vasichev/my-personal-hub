from datetime import datetime, time
from typing import Optional

from pydantic import BaseModel, Field, field_validator

from app.schemas.auth import _validate_tz


class PulseSettingsResponse(BaseModel):
    id: int
    user_id: int
    polling_interval_minutes: int
    digest_schedule: str
    digest_time: time
    timezone: str = "UTC"
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
    reminder_repeat_count: int = 5
    reminder_repeat_interval: int = 5
    reminder_snooze_limit: int = 5
    digest_reminders_enabled: bool = True
    digest_reminders_interval_hours: int = 3
    digest_reminders_start_hour: int = 7
    digest_reminders_end_hour: int = 22
    updated_at: datetime

    model_config = {"from_attributes": True}

    @field_validator("digest_reminders_enabled", mode="before")
    @classmethod
    def _default_digest_reminders_enabled(cls, v: Optional[bool]) -> bool:
        return True if v is None else v

    @field_validator("digest_reminders_interval_hours", mode="before")
    @classmethod
    def _default_digest_reminders_interval_hours(cls, v: Optional[int]) -> int:
        return 3 if v is None else v

    @field_validator("digest_reminders_start_hour", mode="before")
    @classmethod
    def _default_digest_reminders_start_hour(cls, v: Optional[int]) -> int:
        return 7 if v is None else v

    @field_validator("digest_reminders_end_hour", mode="before")
    @classmethod
    def _default_digest_reminders_end_hour(cls, v: Optional[int]) -> int:
        return 22 if v is None else v


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
    reminder_repeat_count: Optional[int] = Field(None, ge=1, le=50)
    reminder_repeat_interval: Optional[int] = Field(None, ge=1, le=1440)
    reminder_snooze_limit: Optional[int] = Field(None, ge=0, le=50)
    digest_reminders_enabled: Optional[bool] = None
    digest_reminders_interval_hours: Optional[int] = Field(None, ge=1, le=24)
    digest_reminders_start_hour: Optional[int] = Field(None, ge=0, le=23)
    digest_reminders_end_hour: Optional[int] = Field(None, ge=0, le=23)

    @field_validator("timezone")
    @classmethod
    def _check_timezone(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        return _validate_tz(v)
