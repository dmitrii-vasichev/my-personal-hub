"""add completed_at to reminders

Revision ID: 3d99cd85a031
Revises: 91e70bc8b5d3
Create Date: 2026-04-07 11:12:49.309371

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3d99cd85a031'
down_revision: Union[str, None] = '91e70bc8b5d3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('reminders', sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('reminders', 'completed_at')
