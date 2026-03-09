from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.calendar import (
    CalendarEventCreate,
    CalendarEventDetailResponse,
    CalendarEventResponse,
    CalendarEventUpdate,
    EventNoteCreate,
    EventNoteResponse,
    EventNoteUpdate,
)
from app.schemas.calendar import (
    GoogleOAuthConnectResponse,
    GoogleOAuthStatus,
)
from app.services import calendar as calendar_service
from app.services import google_calendar as gcal_service
from app.services import google_oauth as oauth_service

router = APIRouter(prefix="/api/calendar", tags=["calendar"])


# ── Events ────────────────────────────────────────────────────────────────────


@router.get("/events/", response_model=list[CalendarEventResponse])
async def list_events(
    start: Optional[datetime] = Query(None),
    end: Optional[datetime] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    events = await calendar_service.list_events(db, current_user, start=start, end=end)
    result = []
    for event in events:
        notes_count = len(event.notes)
        event_dict = {
            **{c.key: getattr(event, c.key) for c in event.__table__.columns},
            "notes_count": notes_count,
        }
        result.append(CalendarEventResponse.model_validate(event_dict))
    return result


@router.get("/events/{event_id}", response_model=CalendarEventDetailResponse)
async def get_event(
    event_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    event = await calendar_service.get_event(db, event_id, current_user)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    notes_count = len(event.notes)
    event_dict = {
        **{c.key: getattr(event, c.key) for c in event.__table__.columns},
        "notes_count": notes_count,
        "notes": event.notes,
    }
    return CalendarEventDetailResponse.model_validate(event_dict)


@router.post("/events/", response_model=CalendarEventResponse, status_code=status.HTTP_201_CREATED)
async def create_event(
    data: CalendarEventCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if data.end_time <= data.start_time:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="end_time must be after start_time",
        )
    event = await calendar_service.create_event(db, data, current_user)
    event_dict = {
        **{c.key: getattr(event, c.key) for c in event.__table__.columns},
        "notes_count": 0,
    }
    return CalendarEventResponse.model_validate(event_dict)


@router.patch("/events/{event_id}", response_model=CalendarEventResponse)
async def update_event(
    event_id: int,
    data: CalendarEventUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    event = await calendar_service.update_event(db, event_id, data, current_user)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    notes_count = len(event.notes)
    event_dict = {
        **{c.key: getattr(event, c.key) for c in event.__table__.columns},
        "notes_count": notes_count,
    }
    return CalendarEventResponse.model_validate(event_dict)


@router.delete("/events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event(
    event_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    deleted = await calendar_service.delete_event(db, event_id, current_user)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")


# ── Event Notes ───────────────────────────────────────────────────────────────


@router.get("/events/{event_id}/notes/", response_model=list[EventNoteResponse])
async def list_notes(
    event_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notes = await calendar_service.list_notes(db, event_id, current_user)
    if notes is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    return notes


@router.post(
    "/events/{event_id}/notes/",
    response_model=EventNoteResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_note(
    event_id: int,
    data: EventNoteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    note = await calendar_service.create_note(db, event_id, data, current_user)
    if note is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    return note


@router.patch("/notes/{note_id}", response_model=EventNoteResponse)
async def update_note(
    note_id: int,
    data: EventNoteUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    note = await calendar_service.update_note(db, note_id, data, current_user)
    if note is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
    return note


@router.delete("/notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note(
    note_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    deleted = await calendar_service.delete_note(db, note_id, current_user)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")


# ── Google OAuth2 ─────────────────────────────────────────────────────────────


@router.get("/oauth/status", response_model=GoogleOAuthStatus)
async def google_oauth_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await oauth_service.get_status(db, current_user)
    return GoogleOAuthStatus(**result)


@router.get("/oauth/connect", response_model=GoogleOAuthConnectResponse)
async def google_oauth_connect(
    current_user: User = Depends(get_current_user),
):
    """Return Google OAuth2 authorization URL. Frontend redirects user to this URL."""
    from app.core.config import settings as cfg
    if not cfg.GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google Calendar integration is not configured",
        )
    state = f"user_{current_user.id}"
    auth_url = oauth_service.get_authorization_url(state)
    return GoogleOAuthConnectResponse(auth_url=auth_url)


@router.get("/oauth/callback")
async def google_oauth_callback(
    code: str = Query(...),
    state: str = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Handle OAuth2 callback from Google. Exchange code for tokens."""
    try:
        await oauth_service.exchange_code_for_tokens(db, code, current_user)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to exchange authorization code: {e}",
        )
    return {"message": "Google Calendar connected successfully"}


@router.post("/oauth/disconnect", status_code=status.HTTP_204_NO_CONTENT)
async def google_oauth_disconnect(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Revoke Google OAuth2 tokens and remove from DB."""
    await oauth_service.disconnect(db, current_user)


# ── Sync ──────────────────────────────────────────────────────────────────────


@router.post("/sync")
async def sync_calendar(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Trigger full bidirectional sync with Google Calendar."""
    result = await gcal_service.sync_calendar(db, current_user)
    return result
