from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, field_validator


class GarminConnectRequest(BaseModel):
    email: str
    password: str


class GarminStatusResponse(BaseModel):
    connected: bool
    last_sync_at: Optional[datetime] = None
    sync_status: Optional[str] = None
    sync_error: Optional[str] = None
    sync_interval_minutes: Optional[int] = None
    connected_at: Optional[datetime] = None
    rate_limited_until: Optional[datetime] = None

    model_config = {"from_attributes": True}


class GarminSyncIntervalRequest(BaseModel):
    interval_minutes: int

    @field_validator("interval_minutes")
    @classmethod
    def validate_interval(cls, v: int) -> int:
        allowed = {60, 120, 240, 360, 720, 1440}
        if v not in allowed:
            raise ValueError(f"interval_minutes must be one of {sorted(allowed)}")
        return v


class VitalsDailyMetricResponse(BaseModel):
    id: int
    date: date
    steps: Optional[int] = None
    distance_m: Optional[float] = None
    calories_active: Optional[int] = None
    calories_total: Optional[int] = None
    floors_climbed: Optional[int] = None
    intensity_minutes: Optional[int] = None
    resting_hr: Optional[int] = None
    avg_hr: Optional[int] = None
    max_hr: Optional[int] = None
    min_hr: Optional[int] = None
    avg_stress: Optional[int] = None
    max_stress: Optional[int] = None
    body_battery_high: Optional[int] = None
    body_battery_low: Optional[int] = None
    vo2_max: Optional[float] = None

    model_config = {"from_attributes": True}


class VitalsSleepResponse(BaseModel):
    id: int
    date: date
    duration_seconds: Optional[int] = None
    deep_seconds: Optional[int] = None
    light_seconds: Optional[int] = None
    rem_seconds: Optional[int] = None
    awake_seconds: Optional[int] = None
    sleep_score: Optional[int] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None

    model_config = {"from_attributes": True}


class VitalsActivityResponse(BaseModel):
    id: int
    garmin_activity_id: int
    activity_type: str
    name: Optional[str] = None
    start_time: datetime
    duration_seconds: Optional[int] = None
    distance_m: Optional[float] = None
    avg_hr: Optional[int] = None
    max_hr: Optional[int] = None
    calories: Optional[int] = None
    avg_pace: Optional[str] = None
    elevation_gain: Optional[float] = None

    model_config = {"from_attributes": True}


class VitalsBriefingResponse(BaseModel):
    id: int
    date: date
    content: str
    generated_at: datetime

    model_config = {"from_attributes": True}


class VitalsTodayResponse(BaseModel):
    metrics: Optional[VitalsDailyMetricResponse] = None
    sleep: Optional[VitalsSleepResponse] = None
    recent_activities: list[VitalsActivityResponse] = []


class VitalsSyncLogResponse(BaseModel):
    id: int
    started_at: datetime
    finished_at: Optional[datetime] = None
    status: str
    error_message: Optional[str] = None
    records_synced: Optional[dict] = None
    duration_ms: Optional[int] = None

    model_config = {"from_attributes": True}


class VitalsDashboardSummaryResponse(BaseModel):
    metrics: Optional[VitalsDailyMetricResponse] = None
    sleep: Optional[VitalsSleepResponse] = None
    connected: bool = False
    last_sync_at: Optional[datetime] = None
    sync_interval_minutes: Optional[int] = None
    briefing_insight: Optional[str] = None
    metrics_7d: list[VitalsDailyMetricResponse] = []
    sleep_7d: list[VitalsSleepResponse] = []
