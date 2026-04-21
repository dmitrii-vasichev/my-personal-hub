"""Focus sessions API endpoints (D12).

Thin HTTP layer over ``app.services.focus_session``. Write endpoints are
guarded by ``restrict_demo``; reads remain available to demo users. The
service layer raises ``HTTPException`` for validation (404 / 409) so the
router simply forwards the result envelope.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, restrict_demo
from app.models.user import User
from app.schemas.focus_session import (
    FocusSessionResponse,
    FocusSessionStart,
    FocusSessionTodayResponse,
)
from app.services import focus_session as service

router = APIRouter(prefix="/api/focus-sessions", tags=["focus-sessions"])


@router.post(
    "/start",
    response_model=FocusSessionResponse,
    status_code=201,
)
async def start_session(
    payload: FocusSessionStart,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(restrict_demo),
):
    """Start a new Pomodoro-style focus session.

    Returns 409 if the user already has an active session, 404 if the
    referenced task / plan item doesn't belong to the user. Demo users
    receive 403.
    """
    session = await service.start(db, current_user, payload)
    return service._to_response(session)


@router.patch(
    "/{session_id}/stop",
    response_model=FocusSessionResponse,
)
async def stop_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(restrict_demo),
):
    """Stop an active focus session or return the already-stopped one.

    Idempotent — calling stop on an already-ended session returns the
    current state unchanged. Demo users receive 403.
    """
    session = await service.stop(db, current_user, session_id)
    return service._to_response(session)


@router.get(
    "/active",
    response_model=Optional[FocusSessionResponse],
)
async def read_active_session(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the user's currently-active focus session or ``null``."""
    session = await service.get_active(db, current_user)
    if session is None:
        return None
    return service._to_response(session)


@router.get(
    "/today",
    response_model=FocusSessionTodayResponse,
)
async def read_today_sessions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return today's focus sessions + total minutes (user's timezone)."""
    return await service.get_today(db, current_user)
