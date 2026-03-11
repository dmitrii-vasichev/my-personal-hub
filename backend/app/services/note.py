"""
Note service — metadata sync from Google Drive and CRUD operations.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.note import Note
from app.models.user import User
from app.schemas.note import NoteTreeNode


async def sync_metadata(
    db: AsyncSession,
    user: User,
    tree: list[NoteTreeNode],
) -> list[Note]:
    """Upsert Note records from Drive tree. Removes stale notes not in tree."""
    seen_file_ids: set[str] = set()
    _collect_file_ids(tree, seen_file_ids)

    # Flatten tree into (google_file_id, title, folder_path, mime_type) tuples
    flat: list[tuple[str, str, str, str]] = []
    _flatten_tree(tree, "", flat)

    now = datetime.now(timezone.utc)

    # Load existing notes for user
    result = await db.execute(
        select(Note).where(Note.user_id == user.id)
    )
    existing = {n.google_file_id: n for n in result.scalars().all()}

    notes: list[Note] = []

    for google_file_id, title, folder_path, mime_type in flat:
        note = existing.get(google_file_id)
        if note:
            note.title = title
            note.folder_path = folder_path
            note.mime_type = mime_type
            note.last_synced_at = now
        else:
            note = Note(
                user_id=user.id,
                google_file_id=google_file_id,
                title=title,
                folder_path=folder_path,
                mime_type=mime_type,
                last_synced_at=now,
            )
            db.add(note)
        notes.append(note)

    # Remove stale notes (no longer in Drive tree)
    stale_ids = set(existing.keys()) - seen_file_ids
    if stale_ids:
        await db.execute(
            delete(Note).where(
                Note.user_id == user.id,
                Note.google_file_id.in_(stale_ids),
            )
        )

    await db.commit()
    # Refresh to get IDs for newly created notes
    for note in notes:
        await db.refresh(note)

    return notes


def _collect_file_ids(nodes: list[NoteTreeNode], result: set[str]) -> None:
    """Recursively collect all file (non-folder) google_file_ids."""
    for node in nodes:
        if node.type == "file":
            result.add(node.google_file_id)
        if node.children:
            _collect_file_ids(node.children, result)


def _flatten_tree(
    nodes: list[NoteTreeNode],
    parent_path: str,
    result: list[tuple[str, str, str, str]],
) -> None:
    """Flatten tree into (google_file_id, title, folder_path, mime_type) tuples."""
    for node in nodes:
        if node.type == "folder":
            folder_path = f"{parent_path}/{node.name}" if parent_path else node.name
            _flatten_tree(node.children, folder_path, result)
        elif node.type == "file":
            mime = "text/markdown"
            result.append((node.google_file_id, node.name, parent_path, mime))


async def get_notes(db: AsyncSession, user: User) -> list[Note]:
    """List all user's synced notes."""
    result = await db.execute(
        select(Note)
        .where(Note.user_id == user.id)
        .order_by(Note.folder_path, Note.title)
    )
    return list(result.scalars().all())


async def get_note(db: AsyncSession, user: User, note_id: int) -> Optional[Note]:
    """Get single note by ID."""
    result = await db.execute(
        select(Note).where(Note.id == note_id, Note.user_id == user.id)
    )
    return result.scalar_one_or_none()


async def get_note_by_google_file_id(
    db: AsyncSession, user: User, google_file_id: str
) -> Optional[Note]:
    """Lookup note by Google Drive file ID."""
    result = await db.execute(
        select(Note).where(
            Note.user_id == user.id,
            Note.google_file_id == google_file_id,
        )
    )
    return result.scalar_one_or_none()
