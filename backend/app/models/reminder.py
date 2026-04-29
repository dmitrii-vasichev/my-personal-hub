import enum
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    BigInteger,
    Boolean,
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


class ReminderStatus(str, enum.Enum):
    pending = "pending"
    done = "done"


class Reminder(Base):
    __tablename__ = "reminders"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    details: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    checklist: Mapped[list] = mapped_column(
        JSON, default=list, server_default="[]", nullable=False
    )
    remind_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    status: Mapped[ReminderStatus] = mapped_column(
        Enum(ReminderStatus), default=ReminderStatus.pending, nullable=False
    )
    snoozed_until: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    recurrence_rule: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True
    )  # "daily", "weekly", "monthly", "yearly", "custom:mon,wed,fri"
    snooze_count: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0", nullable=False
    )
    notification_sent_count: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0", nullable=False
    )
    telegram_message_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, nullable=True
    )
    task_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=True, unique=True, index=True
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    is_floating: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false", nullable=False
    )
    is_urgent: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false", nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    task = relationship("Task", lazy="noload")

    __table_args__ = (
        Index("ix_reminders_user_status", "user_id", "status"),
        Index("ix_reminders_remind_at_status", "remind_at", "status"),
    )
