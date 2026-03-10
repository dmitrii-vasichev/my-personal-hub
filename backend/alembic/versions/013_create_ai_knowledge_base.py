"""create ai_knowledge_base table

Revision ID: 013
Revises: 012
Create Date: 2026-03-10
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "013"
down_revision = "012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ai_knowledge_base",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("slug", sa.String(100), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column(
            "is_default", sa.Boolean(), nullable=False, server_default=sa.text("true")
        ),
        sa.Column("used_by", sa.JSON(), nullable=False, server_default="[]"),
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
        sa.UniqueConstraint("user_id", "slug", name="uq_kb_user_slug"),
    )
    op.create_index("ix_ai_knowledge_base_user_id", "ai_knowledge_base", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_ai_knowledge_base_user_id", table_name="ai_knowledge_base")
    op.drop_table("ai_knowledge_base")
