"""widen recurrence_rule column to 50 chars

Revision ID: 6addc80a71a0
Revises: f1120c5e853b
Create Date: 2026-04-08 15:54:57.131786

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6addc80a71a0'
down_revision: Union[str, None] = 'f1120c5e853b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('reminders', 'recurrence_rule',
               existing_type=sa.VARCHAR(length=20),
               type_=sa.String(length=50),
               existing_nullable=True)


def downgrade() -> None:
    op.alter_column('reminders', 'recurrence_rule',
               existing_type=sa.String(length=50),
               type_=sa.VARCHAR(length=20),
               existing_nullable=True)
