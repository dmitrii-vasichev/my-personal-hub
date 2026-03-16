"""add notified_urgent to pulse_messages

Revision ID: 023
Revises: 022
Create Date: 2026-03-16
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "023"
down_revision = "022"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "pulse_messages",
        sa.Column("notified_urgent", sa.Boolean(), nullable=False, server_default="false"),
    )


def downgrade() -> None:
    op.drop_column("pulse_messages", "notified_urgent")
