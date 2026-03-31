"""create batch_outreach_jobs and batch_outreach_items tables

Revision ID: 042
Revises: 041
Create Date: 2026-03-31
"""

from alembic import op
import sqlalchemy as sa

revision = "042"
down_revision = "041"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "batch_outreach_jobs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "status", sa.String(50), nullable=False, server_default="preparing"
        ),
        sa.Column("total_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("sent_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("failed_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_batch_outreach_jobs_user_id", "batch_outreach_jobs", ["user_id"]
    )

    op.create_table(
        "batch_outreach_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "job_id",
            sa.Integer(),
            sa.ForeignKey("batch_outreach_jobs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "lead_id",
            sa.Integer(),
            sa.ForeignKey("leads.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("subject", sa.String(500), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column(
            "status", sa.String(50), nullable=False, server_default="queued"
        ),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_batch_items_job_status", "batch_outreach_items", ["job_id", "status"]
    )


def downgrade() -> None:
    op.drop_index("ix_batch_items_job_status", table_name="batch_outreach_items")
    op.drop_table("batch_outreach_items")
    op.drop_index("ix_batch_outreach_jobs_user_id", table_name="batch_outreach_jobs")
    op.drop_table("batch_outreach_jobs")
