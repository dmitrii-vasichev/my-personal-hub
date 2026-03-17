"""Add poll status fields to pulse_sources

Revision ID: 026
Revises: 025
Create Date: 2026-03-16
"""

from alembic import op
import sqlalchemy as sa

revision = "026"
down_revision = "025"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "pulse_sources",
        sa.Column("poll_status", sa.String(10), nullable=False, server_default="idle"),
    )
    op.add_column(
        "pulse_sources",
        sa.Column("last_poll_error", sa.Text(), nullable=True),
    )
    op.add_column(
        "pulse_sources",
        sa.Column("last_poll_message_count", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("pulse_sources", "last_poll_message_count")
    op.drop_column("pulse_sources", "last_poll_error")
    op.drop_column("pulse_sources", "poll_status")
