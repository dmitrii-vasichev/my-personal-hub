"""add demo role to userrole enum and content column to notes

Revision ID: 033
Revises: 032
Create Date: 2026-03-19
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "033"
down_revision = "032"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add 'demo' value to userrole enum
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'demo'")

    # Add content column to notes (for local/demo notes without Google Drive)
    op.add_column("notes", sa.Column("content", sa.Text(), nullable=True))

    # Make google_file_id nullable (demo notes don't have Google file IDs)
    op.alter_column(
        "notes",
        "google_file_id",
        existing_type=sa.String(255),
        nullable=True,
    )

    # Drop old unique constraint and create new one that handles nullable google_file_id
    op.drop_constraint("uq_notes_user_file", "notes", type_="unique")
    op.create_index(
        "uq_notes_user_file",
        "notes",
        ["user_id", "google_file_id"],
        unique=True,
        postgresql_where=sa.text("google_file_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_notes_user_file", table_name="notes")
    op.create_unique_constraint("uq_notes_user_file", "notes", ["user_id", "google_file_id"])

    op.alter_column(
        "notes",
        "google_file_id",
        existing_type=sa.String(255),
        nullable=False,
    )

    op.drop_column("notes", "content")

    # Note: PostgreSQL does not support removing enum values in downgrade
