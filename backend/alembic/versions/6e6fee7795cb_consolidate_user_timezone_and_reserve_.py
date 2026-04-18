"""consolidate user timezone and reserve tg fields

Revision ID: 6e6fee7795cb
Revises: 4e525c0165e2
Create Date: 2026-04-17 17:58:26.301643

Phase 1, Task 1:
- Add ``users.timezone`` (NOT NULL, default UTC) and backfill from
  ``pulse_settings.timezone`` (existing single-source-of-truth column).
- Drop ``pulse_settings.timezone``; all callers now read ``User.timezone``.
- Pre-provision ``users.telegram_pin_hash`` and ``users.telegram_user_id``
  (unique + indexed) for Phase 3 (bot PIN authentication).

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6e6fee7795cb'
down_revision: Union[str, None] = '4e525c0165e2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add new columns on users.
    op.add_column(
        'users',
        sa.Column('timezone', sa.String(length=64), nullable=False, server_default='UTC'),
    )
    op.add_column(
        'users',
        sa.Column('telegram_pin_hash', sa.String(length=255), nullable=True),
    )
    op.add_column(
        'users',
        sa.Column('telegram_user_id', sa.BigInteger(), nullable=True),
    )
    op.create_unique_constraint(
        'uq_users_telegram_user_id', 'users', ['telegram_user_id']
    )
    op.create_index(
        'ix_users_telegram_user_id', 'users', ['telegram_user_id'], unique=False
    )

    # 2. Backfill users.timezone from pulse_settings.timezone for rows that
    # have a pulse_settings record. Users without a pulse_settings row retain
    # the 'UTC' server_default set above.
    op.execute(
        """
        UPDATE users u
        SET timezone = COALESCE(ps.timezone, 'UTC')
        FROM pulse_settings ps
        WHERE ps.user_id = u.id
        """
    )

    # 3. Drop the now-redundant column on pulse_settings.
    op.drop_column('pulse_settings', 'timezone')


def downgrade() -> None:
    # Restore the pulse_settings.timezone column with the pre-Phase-1 default.
    op.add_column(
        'pulse_settings',
        sa.Column(
            'timezone',
            sa.String(length=50),
            nullable=False,
            server_default='America/Denver',
        ),
    )
    # Copy the current users.timezone back into pulse_settings so the
    # downgrade is data-preserving.
    op.execute(
        """
        UPDATE pulse_settings ps
        SET timezone = u.timezone
        FROM users u
        WHERE ps.user_id = u.id
        """
    )

    # Remove the columns added to users.
    op.drop_index('ix_users_telegram_user_id', table_name='users')
    op.drop_constraint('uq_users_telegram_user_id', 'users', type_='unique')
    op.drop_column('users', 'telegram_user_id')
    op.drop_column('users', 'telegram_pin_hash')
    op.drop_column('users', 'timezone')
