from pathlib import Path


MIGRATION = (
    Path(__file__).resolve().parents[1]
    / "alembic"
    / "versions"
    / "a1b2c3d4e5f6_add_action_fields.py"
)


def _upgrade_source() -> str:
    source = MIGRATION.read_text()
    return source.split("def upgrade() -> None:", maxsplit=1)[1].split(
        "def downgrade() -> None:",
        maxsplit=1,
    )[0]


def test_action_migration_allows_nullable_remind_at_before_clearing_floating_times():
    upgrade = _upgrade_source()

    nullable_position = upgrade.index(
        'op.alter_column("reminders", "remind_at", '
        "existing_type=sa.DateTime(timezone=True), nullable=True)"
    )
    clear_floating_position = upgrade.index(
        'op.execute("UPDATE reminders SET remind_at = NULL WHERE is_floating = true")'
    )

    assert nullable_position < clear_floating_position
