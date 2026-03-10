"""create job_task_links and job_event_links tables

Revision ID: 014
Revises: 013
Create Date: 2026-03-10
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "014"
down_revision = "013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "job_task_links",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "job_id",
            sa.Integer(),
            sa.ForeignKey("jobs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "task_id",
            sa.Integer(),
            sa.ForeignKey("tasks.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.UniqueConstraint("job_id", "task_id", name="uq_job_task"),
    )
    op.create_index("ix_job_task_links_job_id", "job_task_links", ["job_id"])
    op.create_index("ix_job_task_links_task_id", "job_task_links", ["task_id"])

    op.create_table(
        "job_event_links",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "job_id",
            sa.Integer(),
            sa.ForeignKey("jobs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "event_id",
            sa.Integer(),
            sa.ForeignKey("calendar_events.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.UniqueConstraint("job_id", "event_id", name="uq_job_event"),
    )
    op.create_index("ix_job_event_links_job_id", "job_event_links", ["job_id"])
    op.create_index("ix_job_event_links_event_id", "job_event_links", ["event_id"])


def downgrade() -> None:
    op.drop_index("ix_job_event_links_event_id", table_name="job_event_links")
    op.drop_index("ix_job_event_links_job_id", table_name="job_event_links")
    op.drop_table("job_event_links")

    op.drop_index("ix_job_task_links_task_id", table_name="job_task_links")
    op.drop_index("ix_job_task_links_job_id", table_name="job_task_links")
    op.drop_table("job_task_links")
