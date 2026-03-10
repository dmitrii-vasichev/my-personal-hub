"""merge_application_into_job

Revision ID: 015
Revises: 014
Create Date: 2026-03-10

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "015"
down_revision: Union[str, None] = "014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add Application fields to jobs table
    op.add_column("jobs", sa.Column("status", sa.Enum(
        "found", "saved", "resume_generated", "applied",
        "screening", "technical_interview", "final_interview", "offer",
        "accepted", "rejected", "ghosted", "withdrawn",
        name="applicationstatus", create_type=False,
    ), nullable=True))
    op.add_column("jobs", sa.Column("notes", sa.Text(), nullable=True))
    op.add_column("jobs", sa.Column("recruiter_name", sa.String(255), nullable=True))
    op.add_column("jobs", sa.Column("recruiter_contact", sa.String(255), nullable=True))
    op.add_column("jobs", sa.Column("applied_date", sa.Date(), nullable=True))
    op.add_column("jobs", sa.Column("next_action", sa.String(255), nullable=True))
    op.add_column("jobs", sa.Column("next_action_date", sa.Date(), nullable=True))
    op.add_column("jobs", sa.Column("rejection_reason", sa.Text(), nullable=True))

    # 2. Add job_id columns to status_history, resumes, cover_letters (nullable temporarily)
    op.add_column("status_history", sa.Column("job_id", sa.Integer(), nullable=True))
    op.add_column("resumes", sa.Column("job_id", sa.Integer(), nullable=True))
    op.add_column("cover_letters", sa.Column("job_id", sa.Integer(), nullable=True))

    # 3. Migrate data from applications into jobs
    op.execute("""
        UPDATE jobs SET
            status = a.status,
            notes = a.notes,
            recruiter_name = a.recruiter_name,
            recruiter_contact = a.recruiter_contact,
            applied_date = a.applied_date,
            next_action = a.next_action,
            next_action_date = a.next_action_date,
            rejection_reason = a.rejection_reason
        FROM applications a
        WHERE a.job_id = jobs.id
    """)

    # 4. Migrate FKs via applications join
    op.execute("""
        UPDATE status_history SET job_id = a.job_id
        FROM applications a
        WHERE status_history.application_id = a.id
    """)
    op.execute("""
        UPDATE resumes SET job_id = a.job_id
        FROM applications a
        WHERE resumes.application_id = a.id
    """)
    op.execute("""
        UPDATE cover_letters SET job_id = a.job_id
        FROM applications a
        WHERE cover_letters.application_id = a.id
    """)

    # 5. Make job_id NOT NULL on child tables
    op.alter_column("status_history", "job_id", nullable=False)
    op.alter_column("resumes", "job_id", nullable=False)
    op.alter_column("cover_letters", "job_id", nullable=False)

    # 6. Add FK constraints for new job_id columns
    op.create_foreign_key(
        "fk_status_history_job_id", "status_history", "jobs",
        ["job_id"], ["id"], ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_resumes_job_id", "resumes", "jobs",
        ["job_id"], ["id"], ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_cover_letters_job_id", "cover_letters", "jobs",
        ["job_id"], ["id"], ondelete="CASCADE",
    )

    # 7. Drop old application_id FK and column
    op.drop_constraint("status_history_application_id_fkey", "status_history", type_="foreignkey")
    op.drop_index("ix_status_history_application_id", table_name="status_history")
    op.drop_column("status_history", "application_id")

    op.drop_constraint("resumes_application_id_fkey", "resumes", type_="foreignkey")
    op.drop_index("ix_resumes_application_id", table_name="resumes")
    op.drop_column("resumes", "application_id")

    op.drop_constraint("cover_letters_application_id_fkey", "cover_letters", type_="foreignkey")
    op.drop_index("ix_cover_letters_application_id", table_name="cover_letters")
    op.drop_column("cover_letters", "application_id")

    # 8. Drop applications table
    op.drop_index("ix_applications_user_status", table_name="applications")
    op.drop_index("ix_applications_job_id", table_name="applications")
    op.drop_index("ix_applications_user_id", table_name="applications")
    op.drop_table("applications")

    # 9. Add new indexes
    op.create_index("ix_jobs_user_status", "jobs", ["user_id", "status"])
    op.create_index("ix_status_history_job_id", "status_history", ["job_id"])
    op.create_index("ix_resumes_job_id", "resumes", ["job_id"])
    op.create_index("ix_cover_letters_job_id", "cover_letters", ["job_id"])


def downgrade() -> None:
    # Drop new indexes
    op.drop_index("ix_cover_letters_job_id", table_name="cover_letters")
    op.drop_index("ix_resumes_job_id", table_name="resumes")
    op.drop_index("ix_status_history_job_id", table_name="status_history")
    op.drop_index("ix_jobs_user_status", table_name="jobs")

    # Recreate applications table
    op.create_table(
        "applications",
        sa.Column("id", sa.Integer(), nullable=False, autoincrement=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("job_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.Enum(
            "found", "saved", "resume_generated", "applied",
            "screening", "technical_interview", "final_interview", "offer",
            "accepted", "rejected", "ghosted", "withdrawn",
            name="applicationstatus", create_type=False,
        ), nullable=False, server_default="found"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("recruiter_name", sa.String(255), nullable=True),
        sa.Column("recruiter_contact", sa.String(255), nullable=True),
        sa.Column("applied_date", sa.Date(), nullable=True),
        sa.Column("next_action", sa.String(255), nullable=True),
        sa.Column("next_action_date", sa.Date(), nullable=True),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["job_id"], ["jobs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_applications_user_id", "applications", ["user_id"])
    op.create_index("ix_applications_job_id", "applications", ["job_id"])
    op.create_index("ix_applications_user_status", "applications", ["user_id", "status"])

    # Migrate data back: create applications from jobs that have status
    op.execute("""
        INSERT INTO applications (user_id, job_id, status, notes, recruiter_name, recruiter_contact,
                                  applied_date, next_action, next_action_date, rejection_reason)
        SELECT user_id, id, status, notes, recruiter_name, recruiter_contact,
               applied_date, next_action, next_action_date, rejection_reason
        FROM jobs WHERE status IS NOT NULL
    """)

    # Re-add application_id to child tables
    op.add_column("status_history", sa.Column("application_id", sa.Integer(), nullable=True))
    op.add_column("resumes", sa.Column("application_id", sa.Integer(), nullable=True))
    op.add_column("cover_letters", sa.Column("application_id", sa.Integer(), nullable=True))

    # Migrate FKs back
    op.execute("""
        UPDATE status_history SET application_id = a.id
        FROM applications a WHERE status_history.job_id = a.job_id
    """)
    op.execute("""
        UPDATE resumes SET application_id = a.id
        FROM applications a WHERE resumes.job_id = a.job_id
    """)
    op.execute("""
        UPDATE cover_letters SET application_id = a.id
        FROM applications a WHERE cover_letters.job_id = a.job_id
    """)

    op.alter_column("status_history", "application_id", nullable=False)
    op.alter_column("resumes", "application_id", nullable=False)
    op.alter_column("cover_letters", "application_id", nullable=False)

    op.create_foreign_key(
        "status_history_application_id_fkey", "status_history", "applications",
        ["application_id"], ["id"], ondelete="CASCADE",
    )
    op.create_index("ix_status_history_application_id", "status_history", ["application_id"])

    op.create_foreign_key(
        "resumes_application_id_fkey", "resumes", "applications",
        ["application_id"], ["id"], ondelete="CASCADE",
    )
    op.create_index("ix_resumes_application_id", "resumes", ["application_id"])

    op.create_foreign_key(
        "cover_letters_application_id_fkey", "cover_letters", "applications",
        ["application_id"], ["id"], ondelete="CASCADE",
    )
    op.create_index("ix_cover_letters_application_id", "cover_letters", ["application_id"])

    # Drop new job_id columns from child tables
    op.drop_constraint("fk_status_history_job_id", "status_history", type_="foreignkey")
    op.drop_column("status_history", "job_id")
    op.drop_constraint("fk_resumes_job_id", "resumes", type_="foreignkey")
    op.drop_column("resumes", "job_id")
    op.drop_constraint("fk_cover_letters_job_id", "cover_letters", type_="foreignkey")
    op.drop_column("cover_letters", "job_id")

    # Drop Application columns from jobs
    op.drop_column("jobs", "rejection_reason")
    op.drop_column("jobs", "next_action_date")
    op.drop_column("jobs", "next_action")
    op.drop_column("jobs", "applied_date")
    op.drop_column("jobs", "recruiter_contact")
    op.drop_column("jobs", "recruiter_name")
    op.drop_column("jobs", "notes")
    op.drop_column("jobs", "status")
