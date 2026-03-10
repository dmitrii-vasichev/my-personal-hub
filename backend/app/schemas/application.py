from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel

from app.models.job import ApplicationStatus


# ── Nested summary schemas ─────────────────────────────────────────────────────


class JobSummary(BaseModel):
    """Minimal job info embedded in ApplicationResponse."""

    id: int
    title: str
    company: str
    location: Optional[str]
    match_score: Optional[int] = None

    model_config = {"from_attributes": True}


class StatusHistoryResponse(BaseModel):
    id: int
    application_id: int
    old_status: Optional[str]
    new_status: str
    comment: Optional[str]
    changed_at: datetime

    model_config = {"from_attributes": True}


# ── Application schemas ────────────────────────────────────────────────────────


class ApplicationCreate(BaseModel):
    job_id: int
    status: ApplicationStatus = ApplicationStatus.found


class ApplicationUpdate(BaseModel):
    notes: Optional[str] = None
    recruiter_name: Optional[str] = None
    recruiter_contact: Optional[str] = None
    applied_date: Optional[date] = None
    next_action: Optional[str] = None
    next_action_date: Optional[date] = None
    rejection_reason: Optional[str] = None


class ApplicationStatusChange(BaseModel):
    new_status: ApplicationStatus
    comment: Optional[str] = None


class ApplicationResponse(BaseModel):
    id: int
    user_id: int
    job_id: int
    status: ApplicationStatus
    notes: Optional[str]
    recruiter_name: Optional[str]
    recruiter_contact: Optional[str]
    applied_date: Optional[date]
    next_action: Optional[str]
    next_action_date: Optional[date]
    rejection_reason: Optional[str]
    created_at: datetime
    updated_at: datetime

    job: JobSummary
    status_history: list[StatusHistoryResponse]

    model_config = {"from_attributes": True}


# ── Kanban schemas ─────────────────────────────────────────────────────────────


class KanbanCardResponse(BaseModel):
    """Lightweight application card used in the kanban board."""

    id: int
    job_id: int
    status: ApplicationStatus
    applied_date: Optional[date]
    next_action: Optional[str]
    next_action_date: Optional[date]
    created_at: datetime
    updated_at: datetime

    job: JobSummary

    model_config = {"from_attributes": True}


class KanbanResponse(BaseModel):
    """Kanban board: all 12 status columns with application cards."""

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
