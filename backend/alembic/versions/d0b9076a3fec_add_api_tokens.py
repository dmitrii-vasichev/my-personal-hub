"""add api tokens

Revision ID: d0b9076a3fec
Revises: b09bacb014bb
Create Date: 2026-04-17 21:02:59.817120

Phase 2, Task A2:
- Add ``api_tokens`` table for long-lived bearer tokens used by scripted
  and headless clients. Tokens are stored as bcrypt hashes; a short
  ``token_prefix`` is stored alongside for UI display and hash-candidate
  narrowing.
- Unique per (user_id, name) so users can rotate/name their tokens.
- Indexes on ``user_id`` and ``token_prefix`` support the expected lookup
  patterns (list-by-user, prefix-narrowed hash verification).
- Downgrade fully drops the table and its indexes.

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd0b9076a3fec'
down_revision: Union[str, None] = 'b09bacb014bb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'api_tokens',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('token_hash', sa.String(length=255), nullable=False),
        sa.Column('token_prefix', sa.String(length=12), nullable=False),
        sa.Column('last_used_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'name', name='uq_api_tokens_user_name'),
    )
    op.create_index(
        op.f('ix_api_tokens_token_prefix'),
        'api_tokens',
        ['token_prefix'],
        unique=False,
    )
    op.create_index(
        op.f('ix_api_tokens_user_id'),
        'api_tokens',
        ['user_id'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_api_tokens_user_id'), table_name='api_tokens')
    op.drop_index(op.f('ix_api_tokens_token_prefix'), table_name='api_tokens')
    op.drop_table('api_tokens')
