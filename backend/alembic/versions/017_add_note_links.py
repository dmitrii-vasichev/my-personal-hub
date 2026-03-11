"""add_note_link_tables

Revision ID: 017
Revises: 016
Create Date: 2026-03-10

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "017"
down_revision: Union[str, None] = "016"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. note_task_links
    op.create_table(
        "note_task_links",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "note_id",
            sa.Integer(),
            sa.ForeignKey("notes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "task_id",
            sa.Integer(),
            sa.ForeignKey("tasks.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.UniqueConstraint("note_id", "task_id", name="uq_note_task"),
    )
    op.create_index("ix_note_task_links_note_id", "note_task_links", ["note_id"])
    op.create_index("ix_note_task_links_task_id", "note_task_links", ["task_id"])

    # 2. note_job_links
    op.create_table(
        "note_job_links",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "note_id",
            sa.Integer(),
            sa.ForeignKey("notes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "job_id",
            sa.Integer(),
            sa.ForeignKey("jobs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.UniqueConstraint("note_id", "job_id", name="uq_note_job"),
    )
    op.create_index("ix_note_job_links_note_id", "note_job_links", ["note_id"])
    op.create_index("ix_note_job_links_job_id", "note_job_links", ["job_id"])

    # 3. note_event_links
    op.create_table(
        "note_event_links",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "note_id",
            sa.Integer(),
            sa.ForeignKey("notes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "event_id",
            sa.Integer(),
            sa.ForeignKey("calendar_events.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.UniqueConstraint("note_id", "event_id", name="uq_note_event"),
    )
    op.create_index("ix_note_event_links_note_id", "note_event_links", ["note_id"])
    op.create_index("ix_note_event_links_event_id", "note_event_links", ["event_id"])


def downgrade() -> None:
    op.drop_index("ix_note_event_links_event_id", table_name="note_event_links")
    op.drop_index("ix_note_event_links_note_id", table_name="note_event_links")
    op.drop_table("note_event_links")

    op.drop_index("ix_note_job_links_job_id", table_name="note_job_links")
    op.drop_index("ix_note_job_links_note_id", table_name="note_job_links")
    op.drop_table("note_job_links")

    op.drop_index("ix_note_task_links_task_id", table_name="note_task_links")
    op.drop_index("ix_note_task_links_note_id", table_name="note_task_links")
    op.drop_table("note_task_links")
