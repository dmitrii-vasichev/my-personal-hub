"""create_settings_resumes_cover_letters

Revision ID: 004
Revises: 003
Create Date: 2026-03-08

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # user_settings table
    op.create_table(
        "user_settings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("default_location", sa.String(255), nullable=True),
        sa.Column("target_roles", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("min_match_score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("excluded_companies", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("stale_threshold_days", sa.Integer(), nullable=False, server_default="14"),
        sa.Column("llm_provider", sa.String(50), nullable=False, server_default="openai"),
        sa.Column("api_key_openai", sa.Text(), nullable=True),
        sa.Column("api_key_anthropic", sa.Text(), nullable=True),
        sa.Column("api_key_gemini", sa.Text(), nullable=True),
        sa.Column("api_key_adzuna_id", sa.Text(), nullable=True),
        sa.Column("api_key_adzuna_key", sa.Text(), nullable=True),
        sa.Column("api_key_serpapi", sa.Text(), nullable=True),
        sa.Column("api_key_jsearch", sa.Text(), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_user_settings_user_id", "user_settings", ["user_id"])

    # resumes table
    op.create_table(
        "resumes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "application_id",
            sa.Integer(),
            sa.ForeignKey("applications.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("resume_json", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("pdf_url", sa.Text(), nullable=True),
        sa.Column("ats_score", sa.Integer(), nullable=True),
        sa.Column("ats_audit_result", sa.JSON(), nullable=True),
        sa.Column("gap_analysis", sa.JSON(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_resumes_application_id", "resumes", ["application_id"])

    # cover_letters table
    op.create_table(
        "cover_letters",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "application_id",
            sa.Integer(),
            sa.ForeignKey("applications.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_cover_letters_application_id", "cover_letters", ["application_id"])


def downgrade() -> None:
    op.drop_index("ix_cover_letters_application_id", table_name="cover_letters")
    op.drop_table("cover_letters")

    op.drop_index("ix_resumes_application_id", table_name="resumes")
    op.drop_table("resumes")

    op.drop_index("ix_user_settings_user_id", table_name="user_settings")
    op.drop_table("user_settings")
