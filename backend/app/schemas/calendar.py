from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.models.calendar import EventSource


# ── Calendar Event schemas ────────────────────────────────────────────────────


class CalendarEventCreate(BaseModel):
    title: str
    description: Optional[str] = None
    start_time: datetime
    end_time: datetime
    location: Optional[str] = None
    all_day: bool = False


class CalendarEventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    location: Optional[str] = None
    all_day: Optional[bool] = None


class EventNoteBrief(BaseModel):
    id: int
    content: str
    user_id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CalendarEventResponse(BaseModel):
    id: int
    user_id: int
    google_event_id: Optional[str]
    title: str
    description: Optional[str]
    start_time: datetime
    end_time: datetime
    location: Optional[str]
    all_day: bool
    source: EventSource
    synced_at: Optional[datetime]
    notes_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class LinkedTaskBrief(BaseModel):
    id: int
    title: str
    status: str
    priority: str

    model_config = {"from_attributes": True}


class CalendarEventDetailResponse(CalendarEventResponse):
    notes: list[EventNoteBrief] = []
    linked_tasks: list[LinkedTaskBrief] = []


# ── Event Note schemas ────────────────────────────────────────────────────────


class EventNoteCreate(BaseModel):
    content: str


class EventNoteUpdate(BaseModel):
    content: str


class EventNoteResponse(BaseModel):
    id: int
    event_id: int
    user_id: int
    content: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Google OAuth schemas ──────────────────────────────────────────────────────


class GoogleOAuthStatus(BaseModel):
    connected: bool
    calendar_id: Optional[str] = None
    last_synced: Optional[datetime] = None


class GoogleOAuthConnectResponse(BaseModel):
    auth_url: str
