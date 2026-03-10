"""add google oauth credential columns to user_settings

Revision ID: 011
Revises: 010
Create Date: 2026-03-09
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "011"
down_revision = "010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("user_settings", sa.Column("google_client_id", sa.Text(), nullable=True))
    op.add_column("user_settings", sa.Column("google_client_secret", sa.Text(), nullable=True))
    op.add_column(
        "user_settings", sa.Column("google_redirect_uri", sa.String(500), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("user_settings", "google_redirect_uri")
    op.drop_column("user_settings", "google_client_secret")
    op.drop_column("user_settings", "google_client_id")
