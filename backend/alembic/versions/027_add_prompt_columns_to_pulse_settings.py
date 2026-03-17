"""add prompt columns to pulse_settings

Revision ID: 027
Revises: 026
Create Date: 2026-03-16
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "027"
down_revision = "026"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "pulse_settings",
        sa.Column("prompt_news", sa.Text(), nullable=True),
    )
    op.add_column(
        "pulse_settings",
        sa.Column("prompt_jobs", sa.Text(), nullable=True),
    )
    op.add_column(
        "pulse_settings",
        sa.Column("prompt_learning", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("pulse_settings", "prompt_learning")
    op.drop_column("pulse_settings", "prompt_jobs")
    op.drop_column("pulse_settings", "prompt_news")
