"""add rich reminder fields

Revision ID: 9c1d2e3f4a5b
Revises: 8b9c0d1e2f3a
Create Date: 2026-04-29 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "9c1d2e3f4a5b"
down_revision: Union[str, None] = "8b9c0d1e2f3a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("reminders", sa.Column("details", sa.Text(), nullable=True))
    op.add_column(
        "reminders",
        sa.Column(
            "checklist",
            sa.JSON(),
            server_default=sa.text("'[]'::json"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("reminders", "checklist")
    op.drop_column("reminders", "details")
