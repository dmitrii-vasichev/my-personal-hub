"""add rate_limited_until to garmin_connections

Revision ID: 035
Revises: 034
Create Date: 2026-03-20
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "035"
down_revision = "034"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "garmin_connections",
        sa.Column("rate_limited_until", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("garmin_connections", "rate_limited_until")
