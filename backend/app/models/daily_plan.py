import enum
from datetime import date, datetime
from typing import Optional

from sqlalchemy import (
    Date,
    DateTime,
    Enum,
    Float,
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


class PlanItemStatus(str, enum.Enum):
    pending = "pending"
    in_progress = "in_progress"
    done = "done"
    skipped = "skipped"
    rescheduled = "rescheduled"


class DailyPlan(Base):
    __tablename__ = "daily_plans"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    available_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    planned_minutes: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0", nullable=False
    )
    completed_minutes: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0", nullable=False
    )
    adherence_pct: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    replans_count: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0", nullable=False
    )
    # Planned minutes per category, e.g. {"deep_work": 120, "email": 30}.
    categories_planned: Mapped[dict] = mapped_column(
        JSON, default=dict, server_default="{}", nullable=False
    )
    # Actual minutes per category, aggregated from completed plan items.
    categories_actual: Mapped[dict] = mapped_column(
        JSON, default=dict, server_default="{}", nullable=False
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

    items: Mapped[list["PlanItem"]] = relationship(
        "PlanItem",
        back_populates="plan",
        cascade="all, delete-orphan",
        order_by="PlanItem.order",
        lazy="selectin",
    )

    __table_args__ = (
        UniqueConstraint("user_id", "date", name="uq_daily_plans_user_date"),
    )


class PlanItem(Base):
    __tablename__ = "plan_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    plan_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("daily_plans.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # ``order`` is a reserved SQL keyword. Postgres (and SQLAlchemy's
    # default identifier quoting) will double-quote it automatically, so
    # no explicit column-name override is required here.
    order: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    category: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    minutes_planned: Mapped[int] = mapped_column(Integer, nullable=False)
    minutes_actual: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    status: Mapped[PlanItemStatus] = mapped_column(
        Enum(PlanItemStatus), default=PlanItemStatus.pending, nullable=False
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    plan: Mapped["DailyPlan"] = relationship(
        "DailyPlan", back_populates="items", lazy="noload"
    )
    __table_args__ = (
        Index("ix_plan_items_plan_order", "plan_id", "order"),
    )
