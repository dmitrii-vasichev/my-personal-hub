"""add_unique_constraint_on_reminder_task_id

Revision ID: 55d5e2acd495
Revises: fa3257765151
Create Date: 2026-04-06 21:36:29.625514

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '55d5e2acd495'
down_revision: Union[str, None] = 'fa3257765151'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_index('ix_reminders_task_id', table_name='reminders')
    op.create_index(op.f('ix_reminders_task_id'), 'reminders', ['task_id'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_reminders_task_id'), table_name='reminders')
    op.create_index('ix_reminders_task_id', 'reminders', ['task_id'], unique=False)
