from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings as app_settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.services.auth import get_user_by_id
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
from app.services.task import PermissionDeniedError
from app.services import calendar as calendar_service
from app.services import google_calendar as gcal_service
from app.services import google_oauth as oauth_service
from app.services import task_event_link as link_service
from app.schemas.calendar import LinkedTaskBrief

router = APIRouter(prefix="/api/calendar", tags=["calendar"])


def _event_response(event, response_cls=CalendarEventResponse, **extra):
    """Build event response with owner_name derived from loaded owner relationship."""
    notes_count = len(event.notes) if hasattr(event, "notes") and event.notes else 0
    event_dict = {
        **{c.key: getattr(event, c.key) for c in event.__table__.columns},
        "notes_count": notes_count,
        **extra,
    }
    if hasattr(event, "owner") and event.owner is not None:
        event_dict["owner_name"] = event.owner.display_name
    return response_cls.model_validate(event_dict)


# ── Events ────────────────────────────────────────────────────────────────────


@router.get("/events/", response_model=list[CalendarEventResponse])
async def list_events(
    start: Optional[datetime] = Query(None),
    end: Optional[datetime] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    events = await calendar_service.list_events(db, current_user, start=start, end=end)
    return [_event_response(e) for e in events]


@router.get("/events/{event_id}", response_model=CalendarEventDetailResponse)
async def get_event(
    event_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    event = await calendar_service.get_event(db, event_id, current_user)
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    return _event_response(event, CalendarEventDetailResponse, notes=event.notes)


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
    return _event_response(event)


@router.patch("/events/{event_id}", response_model=CalendarEventResponse)
async def update_event(
    event_id: int,
    data: CalendarEventUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        event = await calendar_service.update_event(db, event_id, data, current_user)
    except PermissionDeniedError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    return _event_response(event)


@router.delete("/events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event(
    event_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        deleted = await calendar_service.delete_event(db, event_id, current_user)
    except PermissionDeniedError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
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
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return Google OAuth2 authorization URL. Frontend redirects user to this URL."""
    try:
        state = f"user_{current_user.id}"
        auth_url = await oauth_service.get_authorization_url(db, state)
        return GoogleOAuthConnectResponse(auth_url=auth_url)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google Calendar integration is not configured. Ask your admin to set it up in Settings → Integrations.",
        )


@router.get("/oauth/callback")
async def google_oauth_callback(
    code: str = Query(...),
    state: str = Query(""),
    db: AsyncSession = Depends(get_db),
):
    """Handle OAuth2 callback from Google.

    This endpoint is PUBLIC (no JWT required) because Google redirects
    the user here via browser navigation. The user is identified by the
    ``state`` parameter (format: ``user_<id>``), which was set during
    the ``/oauth/connect`` step.
    """
    frontend = app_settings.FRONTEND_URL.rstrip("/")

    # Parse user ID from state
    if not state.startswith("user_"):
        return RedirectResponse(f"{frontend}/calendar?google=error&reason=invalid_state")

    try:
        user_id = int(state.split("_", 1)[1])
    except (ValueError, IndexError):
        return RedirectResponse(f"{frontend}/calendar?google=error&reason=invalid_state")

    user = await get_user_by_id(db, user_id)
    if user is None:
        return RedirectResponse(f"{frontend}/calendar?google=error&reason=user_not_found")

    try:
        await oauth_service.exchange_code_for_tokens(db, code, user)
    except Exception:
        return RedirectResponse(f"{frontend}/calendar?google=error&reason=token_exchange_failed")

    return RedirectResponse(f"{frontend}/calendar?google=connected")


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


# ── Event-Task links ──────────────────────────────────────────────────────────


@router.post("/events/{event_id}/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def link_event_to_task(
    event_id: int,
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ok = await link_service.link_task_event(db, task_id, event_id, current_user)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task or event not found")


@router.delete("/events/{event_id}/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unlink_event_from_task(
    event_id: int,
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ok = await link_service.unlink_task_event(db, task_id, event_id, current_user)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")


@router.get("/events/{event_id}/tasks", response_model=list[LinkedTaskBrief])
async def get_event_linked_tasks(
    event_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tasks = await link_service.get_linked_tasks(db, event_id, current_user)
    if tasks is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    return tasks
