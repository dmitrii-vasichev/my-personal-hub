"""add pulse digest item read_at

Revision ID: 8b9c0d1e2f3a
Revises: 7a8c9d0e1f2b
Create Date: 2026-04-27 17:05:00.000000

D15:
- Add nullable ``pulse_digest_items.read_at``.
- Read state is independent from processing status
  (``new`` / ``actioned`` / ``skipped``).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "8b9c0d1e2f3a"
down_revision: Union[str, None] = "7a8c9d0e1f2b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "pulse_digest_items",
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_pulse_digest_items_user_unread",
        "pulse_digest_items",
        ["user_id", "read_at"],
        unique=False,
        postgresql_where=sa.text("read_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index(
        "ix_pulse_digest_items_user_unread", table_name="pulse_digest_items"
    )
    op.drop_column("pulse_digest_items", "read_at")
