from __future__ import annotations

from typing import Optional

from sqlalchemy import select, delete, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.note import Note
from app.models.task import Task
from app.models.note_task_link import NoteTaskLink
from app.models.user import User


async def _get_note(db: AsyncSession, note_id: int, user: User) -> Optional[Note]:
    result = await db.execute(
        select(Note).where(Note.id == note_id, Note.user_id == user.id)
    )
    return result.scalar_one_or_none()


async def _get_task(db: AsyncSession, task_id: int, user: User) -> Optional[Task]:
    result = await db.execute(
        select(Task).where(Task.id == task_id, Task.user_id == user.id)
    )
    return result.scalar_one_or_none()


async def link_note_task(
    db: AsyncSession, note_id: int, task_id: int, user: User
) -> bool:
    """Link a note to a task. Returns False if note or task not found."""
    note = await _get_note(db, note_id, user)
    if note is None:
        return False
    task = await _get_task(db, task_id, user)
    if task is None:
        return False

    existing = await db.execute(
        select(NoteTaskLink).where(
            NoteTaskLink.note_id == note_id, NoteTaskLink.task_id == task_id
        )
    )
    if existing.scalar_one_or_none():
        return True

    db.add(NoteTaskLink(note_id=note_id, task_id=task_id))
    await db.commit()
    return True


async def unlink_note_task(
    db: AsyncSession, note_id: int, task_id: int, user: User
) -> bool:
    """Unlink a note from a task. Returns False if note not found."""
    note = await _get_note(db, note_id, user)
    if note is None:
        return False
    task = await _get_task(db, task_id, user)
    if task is None:
        return False

    await db.execute(
        delete(NoteTaskLink).where(
            NoteTaskLink.note_id == note_id, NoteTaskLink.task_id == task_id
        )
    )
    await db.execute(
        update(Task)
        .where(
            Task.id == task_id,
            Task.user_id == user.id,
            Task.linked_document_id == note_id,
        )
        .values(linked_document_id=None)
    )
    await db.commit()
    return True


async def get_note_linked_tasks(
    db: AsyncSession, note_id: int, user: User
) -> Optional[list[Task]]:
    """Return tasks linked to a note, or None if note not found."""
    note = await _get_note(db, note_id, user)
    if note is None:
        return None

    result = await db.execute(
        select(Task)
        .join(NoteTaskLink, NoteTaskLink.task_id == Task.id)
        .where(NoteTaskLink.note_id == note_id)
        .order_by(Task.title)
    )
    return list(result.scalars().all())


async def get_task_linked_notes(
    db: AsyncSession, task_id: int, user: User
) -> Optional[list[Note]]:
    """Return notes linked to a task, or None if task not found."""
    task = await _get_task(db, task_id, user)
    if task is None:
        return None

    result = await db.execute(
        select(Note)
        .join(NoteTaskLink, NoteTaskLink.note_id == Note.id)
        .where(NoteTaskLink.task_id == task_id)
        .order_by(Note.title)
    )
    return list(result.scalars().all())
