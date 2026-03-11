"""add backlog to taskstatus enum

Revision ID: 020
Revises: 019
Create Date: 2026-03-11

"""
from typing import Sequence, Union

from alembic import op

revision: str = "020"
down_revision: Union[str, None] = "019"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE taskstatus ADD VALUE 'backlog' BEFORE 'new'")


def downgrade() -> None:
    # PostgreSQL enum value removal is complex — skip for personal project
    pass
