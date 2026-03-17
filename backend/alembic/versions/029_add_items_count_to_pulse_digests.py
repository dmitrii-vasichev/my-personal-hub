"""add items_count to pulse_digests

Revision ID: 029
Revises: 028
Create Date: 2026-03-16
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "029"
down_revision = "028"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("pulse_digests", sa.Column("items_count", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("pulse_digests", "items_count")
