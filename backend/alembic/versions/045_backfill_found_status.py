"""Backfill NULL job statuses with 'found'.

Revision ID: 045
Revises: 044
Create Date: 2026-04-03
"""

from alembic import op

revision = "045"
down_revision = "044"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        UPDATE jobs SET status = 'found' WHERE status IS NULL
    """)


def downgrade() -> None:
    pass
