from __future__ import annotations

from typing import Optional

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.job import Job
from app.models.task import Task
from app.models.job_task_link import JobTaskLink
from app.models.user import User


async def _get_job(db: AsyncSession, job_id: int, user: User) -> Optional[Job]:
    result = await db.execute(
        select(Job).where(Job.id == job_id, Job.user_id == user.id)
    )
    return result.scalar_one_or_none()


async def _get_task(db: AsyncSession, task_id: int, user: User) -> Optional[Task]:
    result = await db.execute(
        select(Task).where(Task.id == task_id, Task.user_id == user.id)
    )
    return result.scalar_one_or_none()


async def link_job_task(
    db: AsyncSession, job_id: int, task_id: int, user: User
) -> bool:
    """Link a task to a job. Returns False if job or task not found."""
    job = await _get_job(db, job_id, user)
    if job is None:
        return False
    task = await _get_task(db, task_id, user)
    if task is None:
        return False

    existing = await db.execute(
        select(JobTaskLink).where(
            JobTaskLink.job_id == job_id, JobTaskLink.task_id == task_id
        )
    )
    if existing.scalar_one_or_none():
        return True

    db.add(JobTaskLink(job_id=job_id, task_id=task_id))
    await db.commit()
    return True


async def unlink_job_task(
    db: AsyncSession, job_id: int, task_id: int, user: User
) -> bool:
    """Unlink a task from a job. Returns False if job not found."""
    job = await _get_job(db, job_id, user)
    if job is None:
        return False

    await db.execute(
        delete(JobTaskLink).where(
            JobTaskLink.job_id == job_id, JobTaskLink.task_id == task_id
        )
    )
    await db.commit()
    return True


async def get_job_linked_tasks(
    db: AsyncSession, job_id: int, user: User
) -> Optional[list[Task]]:
    """Return tasks linked to a job, or None if job not found."""
    job = await _get_job(db, job_id, user)
    if job is None:
        return None

    result = await db.execute(
        select(Task)
        .join(JobTaskLink, JobTaskLink.task_id == Task.id)
        .where(JobTaskLink.job_id == job_id)
        .order_by(Task.id)
    )
    return list(result.scalars().all())


async def get_task_linked_jobs(
    db: AsyncSession, task_id: int, user: User
) -> Optional[list[Job]]:
    """Return jobs linked to a task, or None if task not found."""
    task = await _get_task(db, task_id, user)
    if task is None:
        return None

    result = await db.execute(
        select(Job)
        .join(JobTaskLink, JobTaskLink.job_id == Job.id)
        .where(JobTaskLink.task_id == task_id)
        .order_by(Job.id)
    )
    return list(result.scalars().all())
