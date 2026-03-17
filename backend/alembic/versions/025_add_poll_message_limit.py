"""add poll_message_limit to pulse_settings

Revision ID: 025
Revises: 024
Create Date: 2026-03-16
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "025"
down_revision = "024"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "pulse_settings",
        sa.Column(
            "poll_message_limit",
            sa.Integer(),
            nullable=False,
            server_default="100",
        ),
    )


def downgrade() -> None:
    op.drop_column("pulse_settings", "poll_message_limit")
