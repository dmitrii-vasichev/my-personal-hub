import enum
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class ActivityType(str, enum.Enum):
    outbound_email = "outbound_email"
    inbound_email = "inbound_email"
    proposal_sent = "proposal_sent"
    note = "note"
    outbound_call = "outbound_call"
    inbound_call = "inbound_call"
    meeting = "meeting"


class LeadStatus(str, enum.Enum):
    new = "new"
    contacted = "contacted"
    follow_up = "follow_up"
    responded = "responded"
    negotiating = "negotiating"
    won = "won"
    lost = "lost"
    on_hold = "on_hold"


class BatchJobStatus(str, enum.Enum):
    preparing = "preparing"
    sending = "sending"
    paused = "paused"
    completed = "completed"
    cancelled = "cancelled"
    failed = "failed"


class BatchItemStatus(str, enum.Enum):
    queued = "queued"
    sending = "sending"
    sent = "sent"
    failed = "failed"
    skipped = "skipped"


class Lead(Base):
    __tablename__ = "leads"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    business_name: Mapped[str] = mapped_column(String(255), nullable=False)
    industry_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("industries.id", ondelete="SET NULL"), nullable=True
    )
    contact_person: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    website: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    service_description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    source: Mapped[str] = mapped_column(String(50), nullable=False, server_default="manual")
    source_detail: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    status: Mapped[str] = mapped_column(
        String(50), nullable=False, server_default="new"
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    proposal_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    industry: Mapped[Optional["Industry"]] = relationship(
        "Industry", back_populates="leads"
    )
    status_history: Mapped[list["LeadStatusHistory"]] = relationship(
        "LeadStatusHistory", back_populates="lead", cascade="all, delete-orphan"
    )
    activities: Mapped[list["LeadActivity"]] = relationship(
        "LeadActivity", back_populates="lead", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_leads_user_status", "user_id", "status"),
        Index("ix_leads_user_industry", "user_id", "industry_id"),
    )


class LeadStatusHistory(Base):
    __tablename__ = "lead_status_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    lead_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("leads.id", ondelete="CASCADE"), nullable=False, index=True
    )

    old_status: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    new_status: Mapped[str] = mapped_column(String(50), nullable=False)
    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    lead: Mapped["Lead"] = relationship("Lead", back_populates="status_history")


class LeadActivity(Base):
    __tablename__ = "lead_activities"

    id: Mapped[int] = mapped_column(primary_key=True)
    lead_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("leads.id", ondelete="CASCADE"), nullable=False
    )

    activity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    subject: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    body: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    gmail_message_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    gmail_thread_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    lead: Mapped["Lead"] = relationship("Lead", back_populates="activities")

    __table_args__ = (
        Index("ix_lead_activities_lead_id", "lead_id"),
        Index("ix_lead_activities_gmail_thread", "gmail_thread_id"),
    )


class BatchOutreachJob(Base):
    __tablename__ = "batch_outreach_jobs"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    status: Mapped[str] = mapped_column(
        String(50), nullable=False, server_default="preparing"
    )
    total_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    sent_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    failed_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    items: Mapped[list["BatchOutreachItem"]] = relationship(
        "BatchOutreachItem", back_populates="job", cascade="all, delete-orphan"
    )


class BatchOutreachItem(Base):
    __tablename__ = "batch_outreach_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    job_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("batch_outreach_jobs.id", ondelete="CASCADE"),
        nullable=False,
    )
    lead_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("leads.id", ondelete="CASCADE"), nullable=False
    )

    subject: Mapped[str] = mapped_column(String(500), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(
        String(50), nullable=False, server_default="queued"
    )
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    sent_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    job: Mapped["BatchOutreachJob"] = relationship(
        "BatchOutreachJob", back_populates="items"
    )
    lead: Mapped["Lead"] = relationship("Lead")

    __table_args__ = (
        Index("ix_batch_items_job_status", "job_id", "status"),
    )


class Industry(Base):
    __tablename__ = "industries"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), nullable=False)
    prompt_instructions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    cases: Mapped[list] = mapped_column(JSON, default=list, nullable=False, server_default="[]")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    leads: Mapped[list["Lead"]] = relationship("Lead", back_populates="industry")

    __table_args__ = (
        UniqueConstraint("user_id", "slug", name="uq_industries_user_slug"),
    )
