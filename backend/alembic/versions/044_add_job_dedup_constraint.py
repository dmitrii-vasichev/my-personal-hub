"""Add unique partial index on jobs(user_id, url) to prevent duplicates.

Cleans up existing duplicates first, keeping the earliest record.

Revision ID: 044
Revises: 043
Create Date: 2026-04-02
"""

from alembic import op

revision = "044"
down_revision = "1d7947e37f69"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Delete duplicate jobs by (user_id, url), keep the one with smallest id
    op.execute("""
        DELETE FROM jobs
        WHERE id NOT IN (
            SELECT MIN(id)
            FROM jobs
            WHERE url IS NOT NULL
            GROUP BY user_id, url
        )
        AND url IS NOT NULL
    """)

    # Unique partial index: one job per URL per user
    op.create_index(
        "uq_jobs_user_url",
        "jobs",
        ["user_id", "url"],
        unique=True,
        postgresql_where="url IS NOT NULL",
    )


def downgrade() -> None:
    op.drop_index("uq_jobs_user_url", table_name="jobs")
