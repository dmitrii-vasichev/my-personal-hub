"""decommission telegram claude bridge fields

Revision ID: f2a3b4c5d6e7
Revises: e1f2a3b4c5d6
Create Date: 2026-05-15 13:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f2a3b4c5d6e7"
down_revision: Union[str, None] = "e1f2a3b4c5d6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_index("ix_users_telegram_user_id", table_name="users")
    op.drop_constraint("uq_users_telegram_user_id", "users", type_="unique")
    op.drop_column("users", "telegram_user_id")
    op.drop_column("users", "telegram_pin_hash")


def downgrade() -> None:
    op.add_column(
        "users",
        sa.Column("telegram_pin_hash", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("telegram_user_id", sa.BigInteger(), nullable=True),
    )
    op.create_unique_constraint(
        "uq_users_telegram_user_id", "users", ["telegram_user_id"]
    )
    op.create_index(
        "ix_users_telegram_user_id", "users", ["telegram_user_id"], unique=False
    )
