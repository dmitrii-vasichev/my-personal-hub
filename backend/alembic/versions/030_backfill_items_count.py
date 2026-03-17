"""backfill items_count for existing digests

Revision ID: 030
Revises: 029
Create Date: 2026-03-16
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "030"
down_revision = "029"
branch_labels = None
depends_on = None


def _count_items(content: str) -> int:
    """Count bullet-point items in markdown content."""
    count = 0
    for line in content.splitlines():
        stripped = line.strip()
        if stripped.startswith(("- ", "* ", "\u2022 ")) or (
            len(stripped) >= 3 and stripped[0].isdigit() and ". " in stripped[:5]
        ):
            count += 1
    return count


def upgrade() -> None:
    conn = op.get_bind()
    rows = conn.execute(
        sa.text("SELECT id, content FROM pulse_digests WHERE items_count IS NULL")
    ).fetchall()
    for row in rows:
        items_count = _count_items(row[1])
        conn.execute(
            sa.text("UPDATE pulse_digests SET items_count = :count WHERE id = :id"),
            {"count": items_count, "id": row[0]},
        )


def downgrade() -> None:
    op.execute("UPDATE pulse_digests SET items_count = NULL")
