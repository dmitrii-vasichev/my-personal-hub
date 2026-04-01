"""add cases JSON column to industries table

Revision ID: 043
Revises: f270f7c9a854
Create Date: 2026-04-01
"""

from alembic import op
import sqlalchemy as sa

revision = "043"
down_revision = "f270f7c9a854"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "industries",
        sa.Column("cases", sa.JSON(), nullable=False, server_default="[]"),
    )


def downgrade() -> None:
    op.drop_column("industries", "cases")
