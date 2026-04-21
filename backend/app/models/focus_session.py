"""FocusSession model — Pomodoro-style focus timers (D12).

Each row represents one focus-timer run for the owning user, optionally
linked to a ``Task`` and/or ``PlanItem``. ``ended_at`` is ``NULL`` while the
session is still active; a lazy reaper auto-closes sessions whose
``started_at + planned_minutes`` has elapsed.

FKs:
- ``user_id`` → CASCADE on user delete (sessions belong to the user).
- ``task_id`` → SET NULL on task delete (we keep the history even after
  the linked task is removed).
- ``plan_item_id`` → SET NULL on plan item delete for the same reason.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class FocusSession(Base):
    __tablename__ = "focus_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    task_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("tasks.id", ondelete="SET NULL"),
        nullable=True,
    )
    plan_item_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("plan_items.id", ondelete="SET NULL"),
        nullable=True,
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    ended_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    planned_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    auto_closed: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false", nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
