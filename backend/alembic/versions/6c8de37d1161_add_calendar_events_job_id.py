"""add calendar_events job_id

Revision ID: 6c8de37d1161
Revises: 6a6937c87804
Create Date: 2026-04-22 12:49:49.155682

D13, Task 2:
- Add nullable ``calendar_events.job_id`` column with FK to ``jobs.id``
  (ON DELETE SET NULL) so a deleted job leaves its historical event
  rows intact, just unlinked.
- Partial index ``ix_calendar_events_user_job`` narrows "events linked
  to any job for this user" lookups to the subset of rows where
  ``job_id IS NOT NULL`` (used by the Hero "Interviews this week" count).
- Downgrade drops the index first, then the FK, then the column.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6c8de37d1161'
down_revision: Union[str, None] = '6a6937c87804'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'calendar_events',
        sa.Column('job_id', sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        'fk_calendar_events_job_id',
        'calendar_events',
        'jobs',
        ['job_id'],
        ['id'],
        ondelete='SET NULL',
    )
    op.create_index(
        'ix_calendar_events_user_job',
        'calendar_events',
        ['user_id', 'job_id'],
        unique=False,
        postgresql_where=sa.text('job_id IS NOT NULL'),
    )


def downgrade() -> None:
    op.drop_index(
        'ix_calendar_events_user_job', table_name='calendar_events'
    )
    op.drop_constraint(
        'fk_calendar_events_job_id', 'calendar_events', type_='foreignkey'
    )
    op.drop_column('calendar_events', 'job_id')
