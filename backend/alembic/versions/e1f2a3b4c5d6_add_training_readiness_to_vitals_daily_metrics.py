"""add training readiness to vitals daily metrics

Revision ID: e1f2a3b4c5d6
Revises: d4e5f6a7b8c9
Create Date: 2026-05-13
"""
from alembic import op
import sqlalchemy as sa

revision = "e1f2a3b4c5d6"
down_revision = "d4e5f6a7b8c9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "vitals_daily_metrics",
        sa.Column("training_readiness", sa.Integer(), nullable=True),
    )
    op.add_column(
        "vitals_daily_metrics",
        sa.Column("training_readiness_level", sa.String(length=30), nullable=True),
    )
    op.add_column(
        "vitals_daily_metrics",
        sa.Column("training_readiness_recovery_hours", sa.Integer(), nullable=True),
    )
    op.add_column(
        "vitals_daily_metrics",
        sa.Column("training_readiness_feedback", sa.String(length=200), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("vitals_daily_metrics", "training_readiness_feedback")
    op.drop_column("vitals_daily_metrics", "training_readiness_recovery_hours")
    op.drop_column("vitals_daily_metrics", "training_readiness_level")
    op.drop_column("vitals_daily_metrics", "training_readiness")
