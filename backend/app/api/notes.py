"""
Notes API — Google Drive-backed markdown notes.

Endpoints:
- GET  /api/notes/tree           — folder tree (triggers metadata sync)
- GET  /api/notes/{file_id}/content — raw markdown content
- GET  /api/notes/               — list synced note metadata
- GET  /api/notes/{id}           — single note metadata
- POST /api/notes/               — create note (title + markdown → Google Drive)
- POST /api/notes/sync           — force re-sync metadata
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, restrict_demo
from app.models.note import Note
from app.models.user import User, UserRole
from app.schemas.note import LinkedJobBrief, NoteCreate, NoteResponse, NoteTreeResponse
from app.schemas.task import LinkedEventBrief
from app.schemas.calendar import LinkedTaskBrief
from sqlalchemy import select

from app.services import google_drive, google_oauth, note as note_service
from app.services import note_task_link as ntl_service
from app.services import note_job_link as njl_service
from app.services import note_event_link as nel_service
from app.services.settings import get_or_create_settings

router = APIRouter(prefix="/api/notes", tags=["notes"])


async def _get_drive_prerequisites(db: AsyncSession, user: User):
    """Validate Google connection and notes folder configuration.

    Returns (credentials, folder_id) or raises HTTPException.
    """
    credentials = await google_oauth.get_credentials(db, user)
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google account not connected. Please connect via Calendar settings.",
        )

    settings = await get_or_create_settings(db, user)
    folder_id = settings.google_drive_notes_folder_id
    if not folder_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Notes folder not configured. Set google_drive_notes_folder_id in settings.",
        )

    return credentials, folder_id


@router.get("/tree", response_model=NoteTreeResponse)
async def get_notes_tree(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Fetch folder tree from Google Drive and sync metadata."""
    # Demo user: return flat list from local notes (no Google Drive)
    if current_user.role == UserRole.demo:
        result = await db.execute(
            select(Note).where(Note.user_id == current_user.id)
        )
        notes = list(result.scalars().all())
        tree = [
            {
                "id": str(n.id),
                "name": n.title,
                "type": "file",
                "google_file_id": str(n.id),
                "children": [],
            }
            for n in notes
        ]
        return NoteTreeResponse(folder_id="demo", tree=tree)

    credentials, folder_id = await _get_drive_prerequisites(db, current_user)

    try:
        tree = await google_drive.list_folder_tree(credentials, folder_id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to fetch folder tree from Google Drive: {e}",
        )

    # Sync metadata in background
    await note_service.sync_metadata(db, current_user, tree)

    return NoteTreeResponse(folder_id=folder_id, tree=tree)


@router.get("/", response_model=list[NoteResponse])
async def list_notes(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all synced note metadata for current user."""
    notes = await note_service.get_notes(db, current_user)
    return notes


@router.post("/", response_model=NoteResponse, status_code=status.HTTP_201_CREATED)
async def create_note(
    body: NoteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(restrict_demo),
):
    """Create a new note: upload markdown content to Google Drive and save metadata."""
    credentials, folder_id = await _get_drive_prerequisites(db, current_user)

    try:
        note = await note_service.create_note(
            db, current_user, body.title, body.content, credentials, folder_id
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to create note in Google Drive: {e}",
        )

    return note


@router.post("/sync", response_model=list[NoteResponse])
async def sync_notes(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(restrict_demo),
):
    """Force re-sync note metadata from Google Drive."""
    credentials, folder_id = await _get_drive_prerequisites(db, current_user)

    # Invalidate cache to force fresh fetch
    google_drive.invalidate_cache(folder_id)

    try:
        tree = await google_drive.list_folder_tree(
            credentials, folder_id, use_cache=False
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to fetch folder tree from Google Drive: {e}",
        )

    notes = await note_service.sync_metadata(db, current_user, tree)
    return notes


@router.get("/{file_id}/content")
async def get_note_content(
    file_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Fetch raw markdown content for a file from Google Drive or local storage."""
    # Check for local note (demo user or notes with no google_file_id)
    result = await db.execute(
        select(Note).where(
            Note.user_id == current_user.id,
            Note.google_file_id.is_(None),
            Note.id == int(file_id) if file_id.isdigit() else Note.google_file_id == file_id,
        )
    )
    local_note = result.scalar_one_or_none()
    if local_note:
        return {"file_id": file_id, "content": local_note.content or ""}

    # Google Drive note
    credentials, _ = await _get_drive_prerequisites(db, current_user)

    try:
        content = await google_drive.get_file_content(credentials, file_id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to fetch file content from Google Drive: {e}",
        )

    return {"file_id": file_id, "content": content}


@router.get("/{note_id:int}", response_model=NoteResponse)
async def get_note(
    note_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get single note metadata by ID."""
    note = await note_service.get_note(db, current_user, note_id)
    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found",
        )
    return note


# ── Note-Task links ──────────────────────────────────────────────────────────


@router.post("/{note_id:int}/link-task/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def link_note_to_task(
    note_id: int,
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ok = await ntl_service.link_note_task(db, note_id, task_id, current_user)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note or task not found")


@router.delete("/{note_id:int}/link-task/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unlink_note_from_task(
    note_id: int,
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ok = await ntl_service.unlink_note_task(db, note_id, task_id, current_user)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")


@router.get("/{note_id:int}/linked-tasks", response_model=list[LinkedTaskBrief])
async def get_note_linked_tasks(
    note_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tasks = await ntl_service.get_note_linked_tasks(db, note_id, current_user)
    if tasks is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
    return tasks


# ── Note-Job links ───────────────────────────────────────────────────────────


@router.post("/{note_id:int}/link-job/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def link_note_to_job(
    note_id: int,
    job_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ok = await njl_service.link_note_job(db, note_id, job_id, current_user)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note or job not found")


@router.delete("/{note_id:int}/link-job/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unlink_note_from_job(
    note_id: int,
    job_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ok = await njl_service.unlink_note_job(db, note_id, job_id, current_user)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")


@router.get("/{note_id:int}/linked-jobs", response_model=list[LinkedJobBrief])
async def get_note_linked_jobs(
    note_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    jobs = await njl_service.get_note_linked_jobs(db, note_id, current_user)
    if jobs is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
    return jobs


# ── Note-Event links ─────────────────────────────────────────────────────────


@router.post("/{note_id:int}/link-event/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def link_note_to_event(
    note_id: int,
    event_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ok = await nel_service.link_note_event(db, note_id, event_id, current_user)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note or event not found")


@router.delete("/{note_id:int}/link-event/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unlink_note_from_event(
    note_id: int,
    event_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ok = await nel_service.unlink_note_event(db, note_id, event_id, current_user)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")


@router.get("/{note_id:int}/linked-events", response_model=list[LinkedEventBrief])
async def get_note_linked_events(
    note_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    events = await nel_service.get_note_linked_events(db, note_id, current_user)
    if events is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
    return events
