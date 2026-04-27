"""add task linked_document_id

Revision ID: 7a8c9d0e1f2b
Revises: 6c8de37d1161
Create Date: 2026-04-27 16:55:00.000000

D14:
- Add nullable ``tasks.linked_document_id`` pointing at ``notes.id``.
- ``ON DELETE SET NULL`` keeps tasks when the note is removed.
- The column is a primary draft pointer; existing ``note_task_links``
  remains the many-to-many linked notes surface.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "7a8c9d0e1f2b"
down_revision: Union[str, None] = "6c8de37d1161"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "tasks",
        sa.Column("linked_document_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_tasks_linked_document_id",
        "tasks",
        "notes",
        ["linked_document_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_tasks_linked_document_id",
        "tasks",
        ["linked_document_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_tasks_linked_document_id", table_name="tasks")
    op.drop_constraint(
        "fk_tasks_linked_document_id", "tasks", type_="foreignkey"
    )
    op.drop_column("tasks", "linked_document_id")
