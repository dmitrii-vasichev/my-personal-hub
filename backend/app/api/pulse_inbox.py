from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.pulse_inbox import (
    BulkActionRequest,
    InboxAction,
    InboxActionRequest,
    InboxListResponse,
)
from app.services import google_oauth
from app.services import pulse_inbox as inbox_service
from app.services.settings import get_or_create_settings

router = APIRouter(prefix="/api/pulse/inbox", tags=["pulse-inbox"])


async def _get_note_prerequisites(db: AsyncSession, user: User):
    """Get Google credentials and folder_id if available (needed for to_note action)."""
    credentials = await google_oauth.get_credentials(db, user)
    if not credentials:
        return None, None
    settings = await get_or_create_settings(db, user)
    folder_id = settings.google_drive_notes_folder_id
    return credentials, folder_id


@router.get("/", response_model=InboxListResponse)
async def list_inbox_items(
    classification: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List learning inbox items with optional classification filter."""
    items, total = await inbox_service.get_inbox_items(
        db, current_user.id, classification, limit, offset
    )
    return InboxListResponse(items=items, total=total)


@router.post("/{message_id}/action", status_code=status.HTTP_200_OK)
async def action_inbox_item(
    message_id: int,
    body: InboxActionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Route a single inbox item: to_action, to_note, or skip."""
    credentials, folder_id = None, None
    if body.action == InboxAction.to_note:
        credentials, folder_id = await _get_note_prerequisites(db, current_user)
        if not credentials or not folder_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Google Drive not configured. Connect Google and set notes folder in Settings.",
            )

    try:
        ok = await inbox_service.process_action(
            db, current_user, message_id, body.action, credentials, folder_id
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")

    return {"status": "ok", "action": body.action.value, "message_id": message_id}


@router.post("/bulk-action", status_code=status.HTTP_200_OK)
async def bulk_action_inbox(
    body: BulkActionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Bulk route multiple inbox items."""
    credentials, folder_id = None, None
    if body.action == InboxAction.to_note:
        credentials, folder_id = await _get_note_prerequisites(db, current_user)
        if not credentials or not folder_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Google Drive not configured. Connect Google and set notes folder in Settings.",
            )

    try:
        count = await inbox_service.bulk_action(
            db, current_user, body.message_ids, body.action, credentials, folder_id
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return {"status": "ok", "action": body.action.value, "processed": count}
