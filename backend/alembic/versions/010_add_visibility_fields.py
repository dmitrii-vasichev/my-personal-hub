"""add visibility enum and fields to tasks and calendar_events

Revision ID: 010
Revises: 009
Create Date: 2026-03-09
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None

visibility_enum = sa.Enum("family", "private", name="visibility")


def upgrade() -> None:
    visibility_enum.create(op.get_bind(), checkfirst=True)

    op.add_column(
        "tasks",
        sa.Column(
            "visibility",
            sa.Enum("family", "private", name="visibility"),
            nullable=False,
            server_default=sa.text("'family'"),
        ),
    )
    op.add_column(
        "calendar_events",
        sa.Column(
            "visibility",
            sa.Enum("family", "private", name="visibility"),
            nullable=False,
            server_default=sa.text("'family'"),
        ),
    )

    op.create_index("ix_tasks_user_visibility", "tasks", ["user_id", "visibility"])
    op.create_index(
        "ix_calendar_events_user_visibility", "calendar_events", ["user_id", "visibility"]
    )


def downgrade() -> None:
    op.drop_index("ix_calendar_events_user_visibility", "calendar_events")
    op.drop_index("ix_tasks_user_visibility", "tasks")

    op.drop_column("calendar_events", "visibility")
    op.drop_column("tasks", "visibility")

    visibility_enum.drop(op.get_bind(), checkfirst=True)
