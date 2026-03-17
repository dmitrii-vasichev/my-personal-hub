"""add timezone column to pulse_settings

Revision ID: 031
Revises: 030
Create Date: 2026-03-17
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "031"
down_revision = "030"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "pulse_settings",
        sa.Column(
            "timezone",
            sa.String(50),
            nullable=False,
            server_default="America/Denver",
        ),
    )


def downgrade() -> None:
    op.drop_column("pulse_settings", "timezone")
