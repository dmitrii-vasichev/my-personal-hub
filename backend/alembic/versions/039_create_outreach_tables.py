"""create outreach tables (leads, lead_status_history, industries)

Revision ID: 039
Revises: 038
Create Date: 2026-03-27
"""

from alembic import op
import sqlalchemy as sa

revision = "039"
down_revision = "038"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Industries table
    op.create_table(
        "industries",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "user_id", sa.Integer,
            sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(255), nullable=False),
        sa.Column("drive_file_id", sa.String(255), nullable=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True),
            server_default=sa.func.now(), nullable=False,
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True),
            server_default=sa.func.now(), nullable=False,
        ),
        sa.UniqueConstraint("user_id", "slug", name="uq_industries_user_slug"),
    )
    op.create_index("ix_industries_user_id", "industries", ["user_id"])

    # Leads table (status as VARCHAR for migration simplicity)
    op.create_table(
        "leads",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "user_id", sa.Integer,
            sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column("business_name", sa.String(255), nullable=False),
        sa.Column(
            "industry_id", sa.Integer,
            sa.ForeignKey("industries.id", ondelete="SET NULL"), nullable=True,
        ),
        sa.Column("contact_person", sa.String(255), nullable=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("phone", sa.String(100), nullable=True),
        sa.Column("website", sa.Text, nullable=True),
        sa.Column("service_description", sa.Text, nullable=True),
        sa.Column("source", sa.String(50), nullable=False, server_default="manual"),
        sa.Column("source_detail", sa.String(255), nullable=True),
        sa.Column("status", sa.String(50), nullable=False, server_default="new"),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("proposal_text", sa.Text, nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True),
            server_default=sa.func.now(), nullable=False,
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True),
            server_default=sa.func.now(), nullable=False,
        ),
    )
    op.create_index("ix_leads_user_id", "leads", ["user_id"])
    op.create_index("ix_leads_user_status", "leads", ["user_id", "status"])
    op.create_index("ix_leads_user_industry", "leads", ["user_id", "industry_id"])

    # Lead status history table
    op.create_table(
        "lead_status_history",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "lead_id", sa.Integer,
            sa.ForeignKey("leads.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column("old_status", sa.String(50), nullable=True),
        sa.Column("new_status", sa.String(50), nullable=False),
        sa.Column("comment", sa.Text, nullable=True),
        sa.Column(
            "changed_at", sa.DateTime(timezone=True),
            server_default=sa.func.now(), nullable=False,
        ),
    )
    op.create_index("ix_lead_status_history_lead_id", "lead_status_history", ["lead_id"])


def downgrade() -> None:
    op.drop_table("lead_status_history")
    op.drop_table("leads")
    op.drop_table("industries")
