import enum
from datetime import datetime
from typing import TYPE_CHECKING, Optional

if TYPE_CHECKING:
    from app.models.user import User

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.task import Visibility


class EventSource(str, enum.Enum):
    local = "local"
    google = "google"


class CalendarEvent(Base):
    __tablename__ = "calendar_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    google_event_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    location: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    all_day: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    source: Mapped[EventSource] = mapped_column(
        Enum(EventSource), default=EventSource.local, nullable=False
    )
    synced_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    visibility: Mapped[Visibility] = mapped_column(
        Enum(Visibility), default=Visibility.family, nullable=False
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

    owner: Mapped["User"] = relationship(
        "User", foreign_keys=[user_id], lazy="noload"
    )
    notes: Mapped[list["EventNote"]] = relationship(
        "EventNote", back_populates="event", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_calendar_events_user_time", "user_id", "start_time"),
        Index("ix_calendar_events_user_visibility", "user_id", "visibility"),
        UniqueConstraint("user_id", "google_event_id", name="uq_calendar_events_user_google"),
    )


class EventNote(Base):
    __tablename__ = "event_notes"

    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("calendar_events.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    content: Mapped[str] = mapped_column(Text, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    event: Mapped["CalendarEvent"] = relationship("CalendarEvent", back_populates="notes")


class GoogleOAuthToken(Base):
    __tablename__ = "google_oauth_tokens"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    # Stored encrypted via Fernet
    access_token: Mapped[str] = mapped_column(Text, nullable=False)
    refresh_token: Mapped[str] = mapped_column(Text, nullable=False)
    token_expiry: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    calendar_id: Mapped[str] = mapped_column(
        String(255), default="primary", nullable=False
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
