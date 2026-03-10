import enum
from datetime import date, datetime
from typing import Optional

from sqlalchemy import (
    DATE,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class ApplicationStatus(str, enum.Enum):
    found = "found"
    saved = "saved"
    resume_generated = "resume_generated"
    applied = "applied"
    screening = "screening"
    technical_interview = "technical_interview"
    final_interview = "final_interview"
    offer = "offer"
    accepted = "accepted"
    rejected = "rejected"
    ghosted = "ghosted"
    withdrawn = "withdrawn"


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    company: Mapped[str] = mapped_column(String(255), nullable=False)
    location: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    source: Mapped[str] = mapped_column(String(50), nullable=False, server_default="manual")
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    salary_min: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    salary_max: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    salary_currency: Mapped[str] = mapped_column(
        String(10), nullable=False, server_default="USD"
    )

    match_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    match_result: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    tags: Mapped[list] = mapped_column(JSON, default=list, nullable=False, server_default="[]")

    found_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Tracking fields (merged from Application)
    status: Mapped[Optional[ApplicationStatus]] = mapped_column(
        Enum(ApplicationStatus), nullable=True, default=None
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    recruiter_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    recruiter_contact: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    applied_date: Mapped[Optional[date]] = mapped_column(DATE, nullable=True)
    next_action: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    next_action_date: Mapped[Optional[date]] = mapped_column(DATE, nullable=True)
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    status_history: Mapped[list["StatusHistory"]] = relationship(
        "StatusHistory", back_populates="job", cascade="all, delete-orphan"
    )
    resumes: Mapped[list["Resume"]] = relationship(  # type: ignore[name-defined]
        "Resume", back_populates="job", cascade="all, delete-orphan"
    )
    cover_letters: Mapped[list["CoverLetter"]] = relationship(  # type: ignore[name-defined]
        "CoverLetter", back_populates="job", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_jobs_user_status", "user_id", "status"),
    )


class StatusHistory(Base):
    __tablename__ = "status_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    job_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False, index=True
    )

    old_status: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    new_status: Mapped[str] = mapped_column(String(50), nullable=False)
    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    job: Mapped["Job"] = relationship("Job", back_populates="status_history")
