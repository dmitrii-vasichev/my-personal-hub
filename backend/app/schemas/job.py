from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel

from app.models.job import ApplicationStatus


# ── Nested summary schema ─────────────────────────────────────────────────────


class ApplicationSummary(BaseModel):
    """Minimal application info embedded in JobResponse to avoid circular imports."""

    id: int
    status: ApplicationStatus
    applied_date: Optional[date]

    model_config = {"from_attributes": True}


# ── Linked item brief schemas ────────────────────────────────────────────────


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


# ── Job schemas ───────────────────────────────────────────────────────────────


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
    match_score: Optional[int] = None
    tags: list[str] = []
    found_at: Optional[datetime] = None


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
    match_score: Optional[int] = None
    tags: Optional[list[str]] = None
    found_at: Optional[datetime] = None


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
    match_score: Optional[int]
    match_result: Optional[dict] = None
    tags: list[str]
    found_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    # Populated when the current user has a linked application for this job
    application: Optional[ApplicationSummary] = None

    model_config = {"from_attributes": True}
