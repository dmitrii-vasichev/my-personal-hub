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
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    company: Mapped[str] = mapped_column(String(255), nullable=False)
    location: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # VARCHAR(50) intentionally — not an enum, stays extensible for Phase 4
    source: Mapped[str] = mapped_column(String(50), nullable=False, server_default="manual")
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    salary_min: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    salary_max: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    salary_currency: Mapped[str] = mapped_column(
        String(10), nullable=False, server_default="USD"
    )

    # 0-100 match score, populated by AI matching in Phase 4
    match_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    tags: Mapped[list] = mapped_column(JSON, default=list, nullable=False, server_default="[]")

    found_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    applications: Mapped[list["Application"]] = relationship(
        "Application", back_populates="job", cascade="all, delete-orphan"
    )

    __table_args__ = (Index("ix_jobs_user_id", "user_id"),)


class Application(Base):
    __tablename__ = "applications"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    job_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False
    )

    status: Mapped[ApplicationStatus] = mapped_column(
        Enum(ApplicationStatus), default=ApplicationStatus.found, nullable=False
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

    job: Mapped["Job"] = relationship("Job", back_populates="applications")
    status_history: Mapped[list["StatusHistory"]] = relationship(
        "StatusHistory", back_populates="application", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_applications_user_status", "user_id", "status"),
        Index("ix_applications_job_id", "job_id"),
    )


class StatusHistory(Base):
    __tablename__ = "status_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("applications.id", ondelete="CASCADE"), nullable=False
    )

    # null for the initial status entry when an application is first created
    old_status: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    new_status: Mapped[str] = mapped_column(String(50), nullable=False)
    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    application: Mapped["Application"] = relationship(
        "Application", back_populates="status_history"
    )

    __table_args__ = (Index("ix_status_history_application_id", "application_id"),)
