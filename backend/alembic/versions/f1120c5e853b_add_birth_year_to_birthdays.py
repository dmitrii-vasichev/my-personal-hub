"""add birth_year to birthdays

Revision ID: f1120c5e853b
Revises: 80ea5c1e77de
Create Date: 2026-04-08 15:17:29.336865

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f1120c5e853b'
down_revision: Union[str, None] = '80ea5c1e77de'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('birthdays', sa.Column('birth_year', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('birthdays', 'birth_year')
