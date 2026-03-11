"""
Notes API — Google Drive-backed markdown notes.

Endpoints:
- GET  /api/notes/tree           — folder tree (triggers metadata sync)
- GET  /api/notes/{file_id}/content — raw markdown content
- GET  /api/notes/               — list synced note metadata
- GET  /api/notes/{id}           — single note metadata
- POST /api/notes/sync           — force re-sync metadata
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.note import NoteResponse, NoteTreeResponse
from app.services import google_drive, google_oauth, note as note_service
from app.services.settings import get_or_create_settings

router = APIRouter(prefix="/api/notes", tags=["notes"])


async def _get_drive_prerequisites(db: AsyncSession, user: User):
    """Validate Google connection and notes folder configuration.

    Returns (credentials, folder_id) or raises HTTPException.
    """
    credentials = await google_oauth.get_credentials(db, user)
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
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


@router.post("/sync", response_model=list[NoteResponse])
async def sync_notes(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
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
    """Fetch raw markdown content for a file from Google Drive."""
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
