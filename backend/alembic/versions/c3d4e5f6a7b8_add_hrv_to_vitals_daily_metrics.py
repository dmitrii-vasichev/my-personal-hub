"""add hrv to vitals daily metrics

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-05-06 00:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, None] = "b2c3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "vitals_daily_metrics",
        sa.Column("hrv_last_night_avg", sa.Integer(), nullable=True),
    )
    op.add_column(
        "vitals_daily_metrics",
        sa.Column("hrv_weekly_avg", sa.Integer(), nullable=True),
    )
    op.add_column(
        "vitals_daily_metrics",
        sa.Column("hrv_status", sa.String(length=50), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("vitals_daily_metrics", "hrv_status")
    op.drop_column("vitals_daily_metrics", "hrv_weekly_avg")
    op.drop_column("vitals_daily_metrics", "hrv_last_night_avg")
