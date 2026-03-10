"""add user_profiles table, job.match_result, settings instruction fields

Revision ID: 012
Revises: 011
Create Date: 2026-03-10
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "012"
down_revision = "011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # -- user_profiles table --
    op.create_table(
        "user_profiles",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("skills", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("experience", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("education", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("contacts", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("raw_import", sa.Text(), nullable=True),
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
    op.create_index("ix_user_profiles_user_id", "user_profiles", ["user_id"], unique=True)

    # -- jobs.match_result JSON column --
    op.add_column("jobs", sa.Column("match_result", sa.JSON(), nullable=True))

    # -- user_settings instruction fields --
    op.add_column(
        "user_settings", sa.Column("instruction_resume", sa.Text(), nullable=True)
    )
    op.add_column(
        "user_settings", sa.Column("instruction_ats_audit", sa.Text(), nullable=True)
    )
    op.add_column(
        "user_settings",
        sa.Column("instruction_gap_analysis", sa.Text(), nullable=True),
    )
    op.add_column(
        "user_settings",
        sa.Column("instruction_cover_letter", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("user_settings", "instruction_cover_letter")
    op.drop_column("user_settings", "instruction_gap_analysis")
    op.drop_column("user_settings", "instruction_ats_audit")
    op.drop_column("user_settings", "instruction_resume")
    op.drop_column("jobs", "match_result")
    op.drop_index("ix_user_profiles_user_id", table_name="user_profiles")
    op.drop_table("user_profiles")
