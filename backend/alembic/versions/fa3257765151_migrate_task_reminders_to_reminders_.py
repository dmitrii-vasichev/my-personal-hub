"""migrate_task_reminders_to_reminders_table

Revision ID: fa3257765151
Revises: de5130692fc4
Create Date: 2026-04-06 21:31:23.596932

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'fa3257765151'
down_revision: Union[str, None] = 'de5130692fc4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Migrate existing task reminders to the unified reminders table
    op.execute("""
        INSERT INTO reminders (user_id, title, remind_at, status, task_id, created_at, updated_at)
        SELECT
            t.user_id,
            t.title,
            t.reminder_at,
            CASE WHEN t.reminder_dismissed = true THEN 'done' ELSE 'pending' END::reminderstatus,
            t.id,
            NOW(),
            NOW()
        FROM tasks t
        WHERE t.reminder_at IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM reminders r WHERE r.task_id = t.id
          )
    """)


def downgrade() -> None:
    # Remove migrated reminders (those linked to a task)
    op.execute("DELETE FROM reminders WHERE task_id IS NOT NULL")
