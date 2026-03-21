from datetime import date, datetime
from typing import Optional

from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    DateTime,
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
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class GarminConnection(Base):
    __tablename__ = "garmin_connections"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    email_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    password_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    garth_tokens_encrypted: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    sync_interval_minutes: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="240"
    )
    last_sync_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    sync_status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="pending"
    )
    sync_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    rate_limited_until: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    consecutive_failures: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="0", default=0
    )
    connected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class VitalsDailyMetric(Base):
    __tablename__ = "vitals_daily_metrics"
    __table_args__ = (
        UniqueConstraint("user_id", "date", name="uq_vitals_daily_metrics_user_date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    date: Mapped[date] = mapped_column(Date, nullable=False)
    # Activity
    steps: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    distance_m: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    calories_active: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    calories_total: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    floors_climbed: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    intensity_minutes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    # Heart rate
    resting_hr: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    avg_hr: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    max_hr: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    min_hr: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    # Stress & Body Battery
    avg_stress: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    max_stress: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    body_battery_high: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    body_battery_low: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    # Fitness
    vo2_max: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    # Raw API response
    raw_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)


class VitalsSleep(Base):
    __tablename__ = "vitals_sleep"
    __table_args__ = (
        UniqueConstraint("user_id", "date", name="uq_vitals_sleep_user_date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    date: Mapped[date] = mapped_column(Date, nullable=False)
    duration_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    deep_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    light_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    rem_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    awake_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    sleep_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    start_time: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    end_time: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    raw_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)


class VitalsActivity(Base):
    __tablename__ = "vitals_activities"
    __table_args__ = (
        Index("ix_vitals_activities_user_start", "user_id", "start_time"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    garmin_activity_id: Mapped[int] = mapped_column(BigInteger, nullable=False, unique=True)
    activity_type: Mapped[str] = mapped_column(String(100), nullable=False)
    name: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    duration_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    distance_m: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    avg_hr: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    max_hr: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    calories: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    avg_pace: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    elevation_gain: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    raw_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)


class VitalsSyncLog(Base):
    __tablename__ = "vitals_sync_log"
    __table_args__ = (
        Index("ix_vitals_sync_log_user_started", "user_id", "started_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    finished_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False
    )
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    records_synced: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    duration_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)


class VitalsBriefing(Base):
    __tablename__ = "vitals_briefings"
    __table_args__ = (
        UniqueConstraint("user_id", "date", name="uq_vitals_briefings_user_date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    date: Mapped[date] = mapped_column(Date, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    health_data_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    tasks_data_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    calendar_data_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    jobs_data_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
