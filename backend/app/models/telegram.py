from datetime import datetime, time
from typing import Optional

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
    Time,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class TelegramSession(Base):
    __tablename__ = "telegram_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    session_string: Mapped[str] = mapped_column(Text, nullable=False)
    phone_number: Mapped[str] = mapped_column(Text, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    connected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    last_used_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class PulseSource(Base):
    __tablename__ = "pulse_sources"
    __table_args__ = (
        UniqueConstraint("user_id", "telegram_id", name="uq_pulse_sources_user_telegram"),
        Index("ix_pulse_sources_user_active", "user_id", "is_active"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    telegram_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    username: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    subcategory: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    keywords: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    criteria: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    last_polled_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    poll_status: Mapped[str] = mapped_column(
        String(10), nullable=False, server_default="idle"
    )
    last_poll_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    last_poll_message_count: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="0"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class PulseMessage(Base):
    __tablename__ = "pulse_messages"
    __table_args__ = (
        UniqueConstraint(
            "user_id", "source_id", "telegram_message_id",
            name="uq_pulse_messages_user_source_msg",
        ),
        Index("ix_pulse_messages_user_status", "user_id", "status"),
        Index("ix_pulse_messages_user_expires", "user_id", "expires_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    source_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("pulse_sources.id", ondelete="CASCADE"), nullable=False, index=True
    )
    telegram_message_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    sender_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    message_date: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    category: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    ai_relevance: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    ai_classification: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="new")
    notified_urgent: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false"
    )
    collected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    expires_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class PulseDigest(Base):
    __tablename__ = "pulse_digests"
    __table_args__ = (
        Index("ix_pulse_digests_user_cat_gen", "user_id", "category", "generated_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    category: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    digest_type: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="markdown"
    )
    message_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    items_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    period_start: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    period_end: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    items: Mapped[list["PulseDigestItem"]] = relationship(
        "PulseDigestItem", back_populates="digest", cascade="all, delete-orphan"
    )


class PulseSettings(Base):
    __tablename__ = "pulse_settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    polling_interval_minutes: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="60"
    )
    digest_schedule: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="daily"
    )
    digest_time: Mapped[time] = mapped_column(
        Time, nullable=False, server_default="09:00:00"
    )
    # NOTE: timezone moved to users.timezone in Phase 1 (see
    # consolidate_user_timezone_and_reserve_tg migration).
    digest_day: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    digest_interval_days: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    message_ttl_days: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="30"
    )
    telegram_api_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    telegram_api_hash_encrypted: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    bot_token: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    bot_chat_id: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    notify_digest_ready: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="true"
    )
    notify_urgent_jobs: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="true"
    )
    poll_message_limit: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="100"
    )
    prompt_news: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    prompt_jobs: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    prompt_learning: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Reminder notification settings
    reminder_repeat_count: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="5"
    )
    reminder_repeat_interval: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="5"
    )
    reminder_snooze_limit: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="5"
    )
    # Floating reminder digest settings
    digest_reminders_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="true"
    )
    digest_reminders_interval_hours: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="3"
    )
    digest_reminders_start_hour: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="7"
    )
    digest_reminders_end_hour: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="22"
    )
    last_reminder_digest_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Birthday notification defaults
    birthday_advance_days: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="3"
    )
    birthday_reminder_time: Mapped[time] = mapped_column(
        Time, nullable=False, server_default="10:00:00"
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class PulseDigestItem(Base):
    __tablename__ = "pulse_digest_items"
    __table_args__ = (
        Index("ix_pulse_digest_items_digest", "digest_id"),
        Index("ix_pulse_digest_items_user_status", "user_id", "status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    digest_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("pulse_digests.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    classification: Mapped[str] = mapped_column(String(50), nullable=False)
    metadata_: Mapped[Optional[dict]] = mapped_column(
        "metadata", JSON, nullable=True
    )
    source_names: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    source_message_ids: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="new")
    actioned_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    action_type: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    action_result_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    digest: Mapped["PulseDigest"] = relationship(
        "PulseDigest", back_populates="items"
    )
