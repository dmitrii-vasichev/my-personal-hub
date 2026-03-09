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
from app.services import calendar as calendar_service

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
