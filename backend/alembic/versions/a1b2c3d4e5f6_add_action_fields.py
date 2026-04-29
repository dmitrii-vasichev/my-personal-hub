"""Add action fields.

Revision ID: a1b2c3d4e5f6
Revises: 9c1d2e3f4a5b
Create Date: 2026-04-29 00:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "9c1d2e3f4a5b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("reminders", sa.Column("action_date", sa.Date(), nullable=True))
    op.create_index(
        op.f("ix_reminders_action_date"),
        "reminders",
        ["action_date"],
        unique=False,
    )
    op.execute("UPDATE reminders SET action_date = CAST(remind_at AS DATE)")
    op.alter_column("reminders", "remind_at", existing_type=sa.DateTime(timezone=True), nullable=True)
    op.execute("UPDATE reminders SET remind_at = NULL WHERE is_floating = true")

    op.add_column("focus_sessions", sa.Column("action_id", sa.Integer(), nullable=True))
    op.create_index(
        op.f("ix_focus_sessions_action_id"),
        "focus_sessions",
        ["action_id"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_focus_sessions_action_id_reminders",
        "focus_sessions",
        "reminders",
        ["action_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_focus_sessions_action_id_reminders",
        "focus_sessions",
        type_="foreignkey",
    )
    op.drop_index(op.f("ix_focus_sessions_action_id"), table_name="focus_sessions")
    op.drop_column("focus_sessions", "action_id")

    op.execute(
        "UPDATE reminders "
        "SET remind_at = (action_date::timestamp AT TIME ZONE 'UTC') "
        "WHERE remind_at IS NULL AND action_date IS NOT NULL"
    )
    op.alter_column("reminders", "remind_at", existing_type=sa.DateTime(timezone=True), nullable=False)
    op.drop_index(op.f("ix_reminders_action_date"), table_name="reminders")
    op.drop_column("reminders", "action_date")
