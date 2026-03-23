"""backfill NULL digest categories from message data

Revision ID: 028
Revises: 027
Create Date: 2026-03-16
"""
from __future__ import annotations

from alembic import op

revision = "028"
down_revision = "027"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Set NULL-category digests to "news" (the default effective category)
    op.execute(
        "UPDATE pulse_digests SET category = 'news' WHERE category IS NULL"
    )


def downgrade() -> None:
    # Cannot reliably reverse — no-op
    pass
