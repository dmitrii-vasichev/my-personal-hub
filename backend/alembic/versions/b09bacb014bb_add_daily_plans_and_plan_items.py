"""add daily_plans and plan_items

Revision ID: b09bacb014bb
Revises: 6e6fee7795cb
Create Date: 2026-04-17 18:32:32.890075

Phase 1, Task 2:
- Add ``daily_plans`` (one row per user per day) with aggregate metrics
  (planned/completed minutes, adherence, category JSON breakdowns).
- Add ``plan_items`` (ordered entries within a plan) with status enum
  ``planitemstatus`` and optional ``linked_task_id`` (SET NULL on task
  delete so removing a task does not destroy plan history).
- Both tables are fully reversible; downgrade drops tables, indexes, and
  the Postgres enum type.

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b09bacb014bb'
down_revision: Union[str, None] = '6e6fee7795cb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Shared enum descriptor so upgrade() and downgrade() agree on the type name
# and so we can explicitly drop it in downgrade (SQLAlchemy only auto-drops
# the Postgres enum when the Column create/drop path owns it, which is
# fragile across alembic autogen revisions).
plan_item_status_enum = sa.Enum(
    'pending', 'in_progress', 'done', 'skipped', 'rescheduled',
    name='planitemstatus',
)


def upgrade() -> None:
    op.create_table(
        'daily_plans',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('available_minutes', sa.Integer(), nullable=False),
        sa.Column('planned_minutes', sa.Integer(), server_default='0', nullable=False),
        sa.Column('completed_minutes', sa.Integer(), server_default='0', nullable=False),
        sa.Column('adherence_pct', sa.Float(), nullable=True),
        sa.Column('replans_count', sa.Integer(), server_default='0', nullable=False),
        sa.Column('categories_planned', sa.JSON(), server_default='{}', nullable=False),
        sa.Column('categories_actual', sa.JSON(), server_default='{}', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'date', name='uq_daily_plans_user_date'),
    )
    op.create_index(op.f('ix_daily_plans_date'), 'daily_plans', ['date'], unique=False)
    op.create_index(op.f('ix_daily_plans_user_id'), 'daily_plans', ['user_id'], unique=False)

    op.create_table(
        'plan_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('plan_id', sa.Integer(), nullable=False),
        sa.Column('order', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=500), nullable=False),
        sa.Column('category', sa.String(length=100), nullable=True),
        sa.Column('minutes_planned', sa.Integer(), nullable=False),
        sa.Column('minutes_actual', sa.Integer(), nullable=True),
        sa.Column(
            'status',
            plan_item_status_enum,
            nullable=False,
        ),
        sa.Column('linked_task_id', sa.Integer(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['linked_task_id'], ['tasks.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['plan_id'], ['daily_plans.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_plan_items_linked_task_id'), 'plan_items', ['linked_task_id'], unique=False)
    op.create_index(op.f('ix_plan_items_plan_id'), 'plan_items', ['plan_id'], unique=False)
    op.create_index('ix_plan_items_plan_order', 'plan_items', ['plan_id', 'order'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_plan_items_plan_order', table_name='plan_items')
    op.drop_index(op.f('ix_plan_items_plan_id'), table_name='plan_items')
    op.drop_index(op.f('ix_plan_items_linked_task_id'), table_name='plan_items')
    op.drop_table('plan_items')

    # Drop the enum type only after the table that referenced it is gone.
    plan_item_status_enum.drop(op.get_bind(), checkfirst=True)

    op.drop_index(op.f('ix_daily_plans_user_id'), table_name='daily_plans')
    op.drop_index(op.f('ix_daily_plans_date'), table_name='daily_plans')
    op.drop_table('daily_plans')
