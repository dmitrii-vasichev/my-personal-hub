"""add telegram credentials to pulse_settings

Revision ID: 024
Revises: 023
Create Date: 2026-03-16
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "024"
down_revision = "023"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "pulse_settings",
        sa.Column("telegram_api_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "pulse_settings",
        sa.Column("telegram_api_hash_encrypted", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("pulse_settings", "telegram_api_hash_encrypted")
    op.drop_column("pulse_settings", "telegram_api_id")
