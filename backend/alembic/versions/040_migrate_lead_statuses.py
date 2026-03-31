"""migrate lead statuses from 6 to 8 values

Revision ID: 040
Revises: 039
Create Date: 2026-03-31
"""

from alembic import op

revision = "040"
down_revision = "039"
branch_labels = None
depends_on = None

# Old status -> New status mapping
STATUS_MAP = {
    "sent": "contacted",
    "replied": "responded",
    "in_progress": "negotiating",
    "rejected": "lost",
}


def upgrade() -> None:
    for old, new in STATUS_MAP.items():
        op.execute(
            f"UPDATE leads SET status = '{new}' WHERE status = '{old}'"
        )
        op.execute(
            f"UPDATE lead_status_history SET old_status = '{new}' WHERE old_status = '{old}'"
        )
        op.execute(
            f"UPDATE lead_status_history SET new_status = '{new}' WHERE new_status = '{old}'"
        )


def downgrade() -> None:
    reverse_map = {v: k for k, v in STATUS_MAP.items()}
    for old, new in reverse_map.items():
        op.execute(
            f"UPDATE leads SET status = '{new}' WHERE status = '{old}'"
        )
        op.execute(
            f"UPDATE lead_status_history SET old_status = '{new}' WHERE old_status = '{old}'"
        )
        op.execute(
            f"UPDATE lead_status_history SET new_status = '{new}' WHERE new_status = '{old}'"
        )
