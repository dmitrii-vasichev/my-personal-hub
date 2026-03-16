"""add telegram pulse models (5 tables)

Revision ID: 022
Revises: 021
Create Date: 2026-03-16
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "022"
down_revision = "021"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # telegram_sessions
    op.create_table(
        "telegram_sessions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("session_string", sa.Text(), nullable=False),
        sa.Column("phone_number", sa.Text(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "connected_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
    )

    # pulse_sources
    op.create_table(
        "pulse_sources",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("telegram_id", sa.BigInteger(), nullable=False),
        sa.Column("username", sa.String(255), nullable=True),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("category", sa.String(50), nullable=False),
        sa.Column("subcategory", sa.String(255), nullable=True),
        sa.Column("keywords", sa.JSON(), nullable=True),
        sa.Column("criteria", sa.JSON(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("last_polled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("user_id", "telegram_id", name="uq_pulse_sources_user_telegram"),
    )
    op.create_index("ix_pulse_sources_user_id", "pulse_sources", ["user_id"])
    op.create_index("ix_pulse_sources_user_active", "pulse_sources", ["user_id", "is_active"])

    # pulse_messages
    op.create_table(
        "pulse_messages",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "source_id",
            sa.Integer(),
            sa.ForeignKey("pulse_sources.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("telegram_message_id", sa.BigInteger(), nullable=False),
        sa.Column("text", sa.Text(), nullable=True),
        sa.Column("sender_name", sa.String(255), nullable=True),
        sa.Column("message_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("category", sa.String(50), nullable=True),
        sa.Column("ai_relevance", sa.Float(), nullable=True),
        sa.Column("ai_classification", sa.String(50), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="new"),
        sa.Column(
            "collected_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint(
            "user_id", "source_id", "telegram_message_id",
            name="uq_pulse_messages_user_source_msg",
        ),
    )
    op.create_index("ix_pulse_messages_user_id", "pulse_messages", ["user_id"])
    op.create_index("ix_pulse_messages_source_id", "pulse_messages", ["source_id"])
    op.create_index("ix_pulse_messages_user_status", "pulse_messages", ["user_id", "status"])
    op.create_index("ix_pulse_messages_user_expires", "pulse_messages", ["user_id", "expires_at"])

    # pulse_digests
    op.create_table(
        "pulse_digests",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("category", sa.String(50), nullable=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("message_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "generated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("period_start", sa.DateTime(timezone=True), nullable=True),
        sa.Column("period_end", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_pulse_digests_user_id", "pulse_digests", ["user_id"])
    op.create_index(
        "ix_pulse_digests_user_cat_gen",
        "pulse_digests",
        ["user_id", "category", "generated_at"],
    )

    # pulse_settings
    op.create_table(
        "pulse_settings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column(
            "polling_interval_minutes", sa.Integer(), nullable=False, server_default="60"
        ),
        sa.Column(
            "digest_schedule", sa.String(20), nullable=False, server_default="daily"
        ),
        sa.Column("digest_time", sa.Time(), nullable=False, server_default="09:00:00"),
        sa.Column("digest_day", sa.Integer(), nullable=True),
        sa.Column("digest_interval_days", sa.Integer(), nullable=True),
        sa.Column("message_ttl_days", sa.Integer(), nullable=False, server_default="30"),
        sa.Column("bot_token", sa.Text(), nullable=True),
        sa.Column("bot_chat_id", sa.BigInteger(), nullable=True),
        sa.Column(
            "notify_digest_ready", sa.Boolean(), nullable=False, server_default="true"
        ),
        sa.Column(
            "notify_urgent_jobs", sa.Boolean(), nullable=False, server_default="true"
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )


def downgrade() -> None:
    op.drop_table("pulse_settings")

    op.drop_index("ix_pulse_digests_user_cat_gen", table_name="pulse_digests")
    op.drop_index("ix_pulse_digests_user_id", table_name="pulse_digests")
    op.drop_table("pulse_digests")

    op.drop_index("ix_pulse_messages_user_expires", table_name="pulse_messages")
    op.drop_index("ix_pulse_messages_user_status", table_name="pulse_messages")
    op.drop_index("ix_pulse_messages_source_id", table_name="pulse_messages")
    op.drop_index("ix_pulse_messages_user_id", table_name="pulse_messages")
    op.drop_table("pulse_messages")

    op.drop_index("ix_pulse_sources_user_active", table_name="pulse_sources")
    op.drop_index("ix_pulse_sources_user_id", table_name="pulse_sources")
    op.drop_table("pulse_sources")

    op.drop_table("telegram_sessions")
