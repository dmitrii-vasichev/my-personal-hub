"""add salary_period to jobs

Revision ID: 038
Revises: 037
Create Date: 2026-03-26
"""

from alembic import op
import sqlalchemy as sa

revision = "038"
down_revision = "037"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "jobs",
        sa.Column("salary_period", sa.String(10), nullable=False, server_default="yearly"),
    )


def downgrade() -> None:
    op.drop_column("jobs", "salary_period")
