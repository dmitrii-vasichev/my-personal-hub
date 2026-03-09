"""rename userrole enum value 'user' to 'member'

Revision ID: 009
Revises: 008
Create Date: 2026-03-09
"""
from __future__ import annotations

from alembic import op

revision = "009"
down_revision = "008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TYPE userrole RENAME VALUE 'user' TO 'member'")


def downgrade() -> None:
    op.execute("ALTER TYPE userrole RENAME VALUE 'member' TO 'user'")
