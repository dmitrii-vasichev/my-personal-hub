"""add is_blocked, last_login_at, theme to users

Revision ID: 008
Revises: 007
Create Date: 2026-03-09
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "008"
down_revision = "007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("is_blocked", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column(
        "users",
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("theme", sa.String(10), nullable=False, server_default=sa.text("'dark'")),
    )


def downgrade() -> None:
    op.drop_column("users", "theme")
    op.drop_column("users", "last_login_at")
    op.drop_column("users", "is_blocked")
