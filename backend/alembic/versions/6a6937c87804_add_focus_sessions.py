"""add focus_sessions

Revision ID: 6a6937c87804
Revises: d0b9076a3fec
Create Date: 2026-04-21 16:40:46.833666

D12, Task 3:
- Add ``focus_sessions`` table for Pomodoro-style focus timers. Each row is
  one focus run, optionally linked to a ``tasks`` row and/or a
  ``plan_items`` row. Active sessions have ``ended_at IS NULL``; the
  lazy reaper in the service layer closes sessions whose
  ``started_at + planned_minutes`` has elapsed.
- FKs: ``user_id`` CASCADE (session belongs to user), ``task_id`` /
  ``plan_item_id`` SET NULL (keep history after the linked task/plan
  item is deleted).
- Partial index ``idx_focus_sessions_user_active`` narrows the
  "user's currently-active session" lookup to just the unfinished rows.
- Downgrade drops both indexes + the table.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6a6937c87804'
down_revision: Union[str, None] = 'd0b9076a3fec'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'focus_sessions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('task_id', sa.Integer(), nullable=True),
        sa.Column('plan_item_id', sa.Integer(), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('ended_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('planned_minutes', sa.Integer(), nullable=False),
        sa.Column(
            'auto_closed',
            sa.Boolean(),
            server_default=sa.text('false'),
            nullable=False,
        ),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['task_id'], ['tasks.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(
            ['plan_item_id'], ['plan_items.id'], ondelete='SET NULL'
        ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        'ix_focus_sessions_user_id',
        'focus_sessions',
        ['user_id'],
        unique=False,
    )
    op.create_index(
        'idx_focus_sessions_user_active',
        'focus_sessions',
        ['user_id'],
        unique=False,
        postgresql_where=sa.text('ended_at IS NULL'),
    )


def downgrade() -> None:
    op.drop_index(
        'idx_focus_sessions_user_active', table_name='focus_sessions'
    )
    op.drop_index('ix_focus_sessions_user_id', table_name='focus_sessions')
    op.drop_table('focus_sessions')
