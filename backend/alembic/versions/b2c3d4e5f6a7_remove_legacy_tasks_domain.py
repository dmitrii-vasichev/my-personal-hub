"""remove legacy tasks domain

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-04-29 00:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(inspector: sa.Inspector, table_name: str) -> bool:
    return table_name in inspector.get_table_names()


def _column_exists(
    inspector: sa.Inspector, table_name: str, column_name: str
) -> bool:
    if not _table_exists(inspector, table_name):
        return False
    return column_name in {col["name"] for col in inspector.get_columns(table_name)}


def _drop_fk_for_column(
    inspector: sa.Inspector, table_name: str, column_name: str
) -> None:
    if not _table_exists(inspector, table_name):
        return
    for fk in inspector.get_foreign_keys(table_name):
        if column_name in fk.get("constrained_columns", []):
            name = fk.get("name")
            if name:
                op.drop_constraint(name, table_name, type_="foreignkey")


def _drop_index_if_exists(
    inspector: sa.Inspector, table_name: str, index_name: str
) -> None:
    if not _table_exists(inspector, table_name):
        return
    if index_name in {idx["name"] for idx in inspector.get_indexes(table_name)}:
        op.drop_index(index_name, table_name=table_name)


def _drop_column_if_exists(
    inspector: sa.Inspector, table_name: str, column_name: str
) -> None:
    if _column_exists(inspector, table_name, column_name):
        _drop_fk_for_column(inspector, table_name, column_name)
        op.drop_column(table_name, column_name)


def _drop_table_if_exists(inspector: sa.Inspector, table_name: str) -> None:
    if _table_exists(inspector, table_name):
        op.drop_table(table_name)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if _column_exists(inspector, "reminders", "task_id"):
        op.execute("UPDATE reminders SET task_id = NULL WHERE task_id IS NOT NULL")
        _drop_index_if_exists(inspector, "reminders", "ix_reminders_task_id")
        _drop_column_if_exists(inspector, "reminders", "task_id")

    if _column_exists(inspector, "focus_sessions", "task_id"):
        op.execute(
            "UPDATE focus_sessions SET task_id = NULL WHERE task_id IS NOT NULL"
        )
        _drop_column_if_exists(inspector, "focus_sessions", "task_id")

    if _column_exists(inspector, "plan_items", "linked_task_id"):
        op.execute(
            "UPDATE plan_items SET linked_task_id = NULL "
            "WHERE linked_task_id IS NOT NULL"
        )
        _drop_index_if_exists(
            inspector, "plan_items", "ix_plan_items_linked_task_id"
        )
        _drop_column_if_exists(inspector, "plan_items", "linked_task_id")

    if _column_exists(inspector, "vitals_briefings", "tasks_data_json"):
        if not _column_exists(inspector, "vitals_briefings", "actions_data_json"):
            op.alter_column(
                "vitals_briefings",
                "tasks_data_json",
                new_column_name="actions_data_json",
                existing_type=sa.JSON(),
                nullable=True,
            )
        else:
            op.execute(
                "UPDATE vitals_briefings "
                "SET actions_data_json = tasks_data_json "
                "WHERE actions_data_json IS NULL"
            )
            _drop_column_if_exists(inspector, "vitals_briefings", "tasks_data_json")

    for table_name in (
        "task_event_links",
        "job_task_links",
        "note_task_links",
        "task_tags",
        "tags",
        "task_updates",
        "tasks",
    ):
        _drop_table_if_exists(inspector, table_name)

    if bind.dialect.name == "postgresql":
        for enum_name in ("updatetype", "tasksource", "taskpriority", "taskstatus"):
            op.execute(sa.text(f"DROP TYPE IF EXISTS {enum_name}"))


def downgrade() -> None:
    raise NotImplementedError(
        "Legacy task removal is destructive and cannot restore deleted task data."
    )
