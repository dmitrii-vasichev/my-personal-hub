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
from sqlalchemy.orm import Mapped, mapped_column

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
    content: Mapped[str] = mapped_column(Text, nullable=False)
    message_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    period_start: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    period_end: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
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
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
