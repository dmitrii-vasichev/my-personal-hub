"""add kanban_order to tasks

Revision ID: 019
Revises: 018
Create Date: 2026-03-11

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "019"
down_revision: Union[str, None] = "018"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "tasks",
        sa.Column("kanban_order", sa.Float(), nullable=False, server_default="0"),
    )
    op.create_index("ix_tasks_kanban_order", "tasks", ["kanban_order"])


def downgrade() -> None:
    op.drop_index("ix_tasks_kanban_order", table_name="tasks")
    op.drop_column("tasks", "kanban_order")
