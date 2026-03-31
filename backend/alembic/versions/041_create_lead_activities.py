"""create lead_activities table

Revision ID: 041
Revises: 040
Create Date: 2026-03-31
"""

from alembic import op
import sqlalchemy as sa

revision = "041"
down_revision = "040"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "lead_activities",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "lead_id",
            sa.Integer(),
            sa.ForeignKey("leads.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("activity_type", sa.String(50), nullable=False),
        sa.Column("subject", sa.String(500), nullable=True),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("gmail_message_id", sa.String(255), nullable=True),
        sa.Column("gmail_thread_id", sa.String(255), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_lead_activities_lead_id", "lead_activities", ["lead_id"])
    op.create_index(
        "ix_lead_activities_gmail_thread", "lead_activities", ["gmail_thread_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_lead_activities_gmail_thread", table_name="lead_activities")
    op.drop_index("ix_lead_activities_lead_id", table_name="lead_activities")
    op.drop_table("lead_activities")
