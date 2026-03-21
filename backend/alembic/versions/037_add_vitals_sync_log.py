"""add vitals_sync_log table

Revision ID: 037
Revises: 036
Create Date: 2026-03-21
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "037"
down_revision = "036"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "vitals_sync_log",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("records_synced", sa.JSON(), nullable=True),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
    )
    op.create_index(
        "ix_vitals_sync_log_user_started",
        "vitals_sync_log",
        ["user_id", "started_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_vitals_sync_log_user_started", table_name="vitals_sync_log")
    op.drop_table("vitals_sync_log")
