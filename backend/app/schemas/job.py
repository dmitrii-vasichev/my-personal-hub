from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel

from app.models.job import ApplicationStatus


# ── Nested schemas ───────────────────────────────────────────────────────────


class LinkedTaskBrief(BaseModel):
    id: int
    title: str
    status: str
    priority: str

    model_config = {"from_attributes": True}


class LinkedEventBrief(BaseModel):
    id: int
    title: str
    start_time: datetime
    end_time: datetime

    model_config = {"from_attributes": True}


class MatchResultResponse(BaseModel):
    score: int
    matched_skills: list[str]
    missing_skills: list[str]
    strengths: list[str]
    recommendations: list[str]


class StatusHistoryResponse(BaseModel):
    id: int
    job_id: int
    old_status: Optional[str]
    new_status: str
    comment: Optional[str]
    changed_at: datetime

    model_config = {"from_attributes": True}


# ── Job schemas ──────────────────────────────────────────────────────────────


class JobCreate(BaseModel):
    title: str
    company: str
    location: Optional[str] = None
    url: Optional[str] = None
    source: str = "manual"
    description: Optional[str] = None
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    salary_currency: str = "USD"
    salary_period: str = "yearly"
    match_score: Optional[int] = None
    tags: list[str] = []
    found_at: Optional[datetime] = None
    status: Optional[ApplicationStatus] = None


class JobUpdate(BaseModel):
    title: Optional[str] = None
    company: Optional[str] = None
    location: Optional[str] = None
    url: Optional[str] = None
    source: Optional[str] = None
    description: Optional[str] = None
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    salary_currency: Optional[str] = None
    salary_period: Optional[str] = None
    match_score: Optional[int] = None
    tags: Optional[list[str]] = None
    found_at: Optional[datetime] = None
    # Tracking fields
    status: Optional[ApplicationStatus] = None
    notes: Optional[str] = None
    recruiter_name: Optional[str] = None
    recruiter_contact: Optional[str] = None
    applied_date: Optional[date] = None
    next_action: Optional[str] = None
    next_action_date: Optional[date] = None
    rejection_reason: Optional[str] = None


class JobStatusChange(BaseModel):
    new_status: ApplicationStatus
    comment: Optional[str] = None


class JobTrackingUpdate(BaseModel):
    notes: Optional[str] = None
    recruiter_name: Optional[str] = None
    recruiter_contact: Optional[str] = None
    applied_date: Optional[date] = None
    next_action: Optional[str] = None
    next_action_date: Optional[date] = None
    rejection_reason: Optional[str] = None


class JobResponse(BaseModel):
    id: int
    user_id: int
    title: str
    company: str
    location: Optional[str]
    url: Optional[str]
    source: str
    description: Optional[str]
    salary_min: Optional[int]
    salary_max: Optional[int]
    salary_currency: str
    salary_period: str
    match_score: Optional[int]
    match_result: Optional[dict] = None
    tags: list[str]
    found_at: Optional[datetime]
    # Tracking fields
    status: Optional[ApplicationStatus] = None
    notes: Optional[str] = None
    recruiter_name: Optional[str] = None
    recruiter_contact: Optional[str] = None
    applied_date: Optional[date] = None
    next_action: Optional[str] = None
    next_action_date: Optional[date] = None
    rejection_reason: Optional[str] = None
    status_history: list[StatusHistoryResponse] = []

    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Kanban schemas ───────────────────────────────────────────────────────────


class KanbanCardResponse(BaseModel):
    id: int
    title: str
    company: str
    location: Optional[str] = None
    status: ApplicationStatus
    match_score: Optional[int] = None
    applied_date: Optional[date] = None
    next_action: Optional[str] = None
    next_action_date: Optional[date] = None
    updated_at: datetime

    model_config = {"from_attributes": True}


class KanbanResponse(BaseModel):
    found: list[KanbanCardResponse] = []
    saved: list[KanbanCardResponse] = []
    resume_generated: list[KanbanCardResponse] = []
    applied: list[KanbanCardResponse] = []
    screening: list[KanbanCardResponse] = []
    technical_interview: list[KanbanCardResponse] = []
    final_interview: list[KanbanCardResponse] = []
    offer: list[KanbanCardResponse] = []
    accepted: list[KanbanCardResponse] = []
    rejected: list[KanbanCardResponse] = []
    ghosted: list[KanbanCardResponse] = []
    withdrawn: list[KanbanCardResponse] = []
