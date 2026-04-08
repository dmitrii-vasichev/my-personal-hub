"""add_reminder_floating_to_tasks

Revision ID: 4e525c0165e2
Revises: 6addc80a71a0
Create Date: 2026-04-08 17:38:29.752386

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4e525c0165e2'
down_revision: Union[str, None] = '6addc80a71a0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('tasks', sa.Column('reminder_floating', sa.Boolean(), server_default='false', nullable=False))


def downgrade() -> None:
    op.drop_column('tasks', 'reminder_floating')
