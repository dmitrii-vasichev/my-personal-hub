"""add consecutive_failures to garmin_connections

Revision ID: 036
Revises: 035
Create Date: 2026-03-21
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "036"
down_revision = "035"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "garmin_connections",
        sa.Column("consecutive_failures", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("garmin_connections", "consecutive_failures")
