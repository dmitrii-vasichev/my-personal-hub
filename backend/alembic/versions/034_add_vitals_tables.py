"""add vitals tables for Garmin integration

Revision ID: 034
Revises: 033
Create Date: 2026-03-19
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "034"
down_revision = "033"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # GarminConnection
    op.create_table(
        "garmin_connections",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("email_encrypted", sa.Text(), nullable=False),
        sa.Column("password_encrypted", sa.Text(), nullable=False),
        sa.Column("garth_tokens_encrypted", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("sync_interval_minutes", sa.Integer(), nullable=False, server_default="240"),
        sa.Column("last_sync_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("sync_status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("sync_error", sa.Text(), nullable=True),
        sa.Column(
            "connected_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    # VitalsDailyMetric
    op.create_table(
        "vitals_daily_metrics",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("steps", sa.Integer(), nullable=True),
        sa.Column("distance_m", sa.Float(), nullable=True),
        sa.Column("calories_active", sa.Integer(), nullable=True),
        sa.Column("calories_total", sa.Integer(), nullable=True),
        sa.Column("floors_climbed", sa.Integer(), nullable=True),
        sa.Column("intensity_minutes", sa.Integer(), nullable=True),
        sa.Column("resting_hr", sa.Integer(), nullable=True),
        sa.Column("avg_hr", sa.Integer(), nullable=True),
        sa.Column("max_hr", sa.Integer(), nullable=True),
        sa.Column("min_hr", sa.Integer(), nullable=True),
        sa.Column("avg_stress", sa.Integer(), nullable=True),
        sa.Column("max_stress", sa.Integer(), nullable=True),
        sa.Column("body_battery_high", sa.Integer(), nullable=True),
        sa.Column("body_battery_low", sa.Integer(), nullable=True),
        sa.Column("vo2_max", sa.Float(), nullable=True),
        sa.Column("raw_json", sa.JSON(), nullable=True),
        sa.UniqueConstraint("user_id", "date", name="uq_vitals_daily_metrics_user_date"),
    )

    # VitalsSleep
    op.create_table(
        "vitals_sleep",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("duration_seconds", sa.Integer(), nullable=True),
        sa.Column("deep_seconds", sa.Integer(), nullable=True),
        sa.Column("light_seconds", sa.Integer(), nullable=True),
        sa.Column("rem_seconds", sa.Integer(), nullable=True),
        sa.Column("awake_seconds", sa.Integer(), nullable=True),
        sa.Column("sleep_score", sa.Integer(), nullable=True),
        sa.Column("start_time", sa.DateTime(timezone=True), nullable=True),
        sa.Column("end_time", sa.DateTime(timezone=True), nullable=True),
        sa.Column("raw_json", sa.JSON(), nullable=True),
        sa.UniqueConstraint("user_id", "date", name="uq_vitals_sleep_user_date"),
    )

    # VitalsActivity
    op.create_table(
        "vitals_activities",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("garmin_activity_id", sa.BigInteger(), nullable=False, unique=True),
        sa.Column("activity_type", sa.String(100), nullable=False),
        sa.Column("name", sa.String(500), nullable=True),
        sa.Column("start_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("duration_seconds", sa.Integer(), nullable=True),
        sa.Column("distance_m", sa.Float(), nullable=True),
        sa.Column("avg_hr", sa.Integer(), nullable=True),
        sa.Column("max_hr", sa.Integer(), nullable=True),
        sa.Column("calories", sa.Integer(), nullable=True),
        sa.Column("avg_pace", sa.String(50), nullable=True),
        sa.Column("elevation_gain", sa.Float(), nullable=True),
        sa.Column("raw_json", sa.JSON(), nullable=True),
    )
    op.create_index(
        "ix_vitals_activities_user_start",
        "vitals_activities",
        ["user_id", "start_time"],
    )

    # VitalsBriefing
    op.create_table(
        "vitals_briefings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("health_data_json", sa.JSON(), nullable=True),
        sa.Column("tasks_data_json", sa.JSON(), nullable=True),
        sa.Column("calendar_data_json", sa.JSON(), nullable=True),
        sa.Column("jobs_data_json", sa.JSON(), nullable=True),
        sa.Column(
            "generated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("user_id", "date", name="uq_vitals_briefings_user_date"),
    )


def downgrade() -> None:
    op.drop_table("vitals_briefings")
    op.drop_index("ix_vitals_activities_user_start", table_name="vitals_activities")
    op.drop_table("vitals_activities")
    op.drop_table("vitals_sleep")
    op.drop_table("vitals_daily_metrics")
    op.drop_table("garmin_connections")
