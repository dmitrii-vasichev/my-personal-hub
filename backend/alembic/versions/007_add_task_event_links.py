"""add task_event_links table

Revision ID: 007
Revises: 006
Create Date: 2026-03-08
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "007"
down_revision = "006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "task_event_links",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "task_id",
            sa.Integer(),
            sa.ForeignKey("tasks.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "event_id",
            sa.Integer(),
            sa.ForeignKey("calendar_events.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.UniqueConstraint("task_id", "event_id", name="uq_task_event"),
    )
    op.create_index("ix_task_event_links_task_id", "task_event_links", ["task_id"])
    op.create_index("ix_task_event_links_event_id", "task_event_links", ["event_id"])


def downgrade() -> None:
    op.drop_index("ix_task_event_links_event_id", "task_event_links")
    op.drop_index("ix_task_event_links_task_id", "task_event_links")
    op.drop_table("task_event_links")
