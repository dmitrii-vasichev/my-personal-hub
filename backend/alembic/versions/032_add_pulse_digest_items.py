"""add pulse_digest_items table and digest_type to pulse_digests

Revision ID: 032
Revises: 031
Create Date: 2026-03-19
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "032"
down_revision = "031"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Make content nullable on pulse_digests
    op.alter_column("pulse_digests", "content", existing_type=sa.Text(), nullable=True)

    # Add digest_type column
    op.add_column(
        "pulse_digests",
        sa.Column("digest_type", sa.String(20), nullable=False, server_default="markdown"),
    )

    # Create pulse_digest_items table
    op.create_table(
        "pulse_digest_items",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "digest_id",
            sa.Integer,
            sa.ForeignKey("pulse_digests.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.Integer,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("summary", sa.Text, nullable=False),
        sa.Column("classification", sa.String(50), nullable=False),
        sa.Column("metadata", sa.JSON, nullable=True),
        sa.Column("source_names", sa.JSON, nullable=True),
        sa.Column("source_message_ids", sa.JSON, nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="new"),
        sa.Column("actioned_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("action_type", sa.String(20), nullable=True),
        sa.Column("action_result_id", sa.Integer, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    op.create_index("ix_pulse_digest_items_digest", "pulse_digest_items", ["digest_id"])
    op.create_index(
        "ix_pulse_digest_items_user_status", "pulse_digest_items", ["user_id", "status"]
    )


def downgrade() -> None:
    op.drop_index("ix_pulse_digest_items_user_status", table_name="pulse_digest_items")
    op.drop_index("ix_pulse_digest_items_digest", table_name="pulse_digest_items")
    op.drop_table("pulse_digest_items")

    op.drop_column("pulse_digests", "digest_type")
    op.alter_column("pulse_digests", "content", existing_type=sa.Text(), nullable=False)
