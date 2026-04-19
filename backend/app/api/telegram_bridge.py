"""HTTP endpoints used by the Telegram→Claude-Code bridge bot (Phase 2).

Two endpoints live here under ``/api/telegram/auth``:

* ``POST /check-sender`` — the bot calls this on every incoming update to
  confirm the Telegram ``user.id`` matches ``users.telegram_user_id`` for
  the authenticated Hub owner. Single-tenant deployment ⇒
  ``current_user`` IS the owner.
* ``POST /verify-pin`` — the bot calls this when the owner sends
  ``/unlock <pin>`` in Telegram. We bcrypt-compare against
  ``users.telegram_pin_hash`` and apply an in-process rate-limit
  (5 failures / 10 min / user → 15 min lockout) to blunt brute force.

Both endpoints use ``restrict_demo`` (which chains ``get_current_user``),
so demo accounts are rejected and the bot authenticates with the same
hybrid JWT/``phub_…`` API-token flow as every other UI endpoint.

The PIN-update and TG-user-id-update endpoints live on the existing
``/api/users`` router (see ``app/api/users.py``).
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.deps import restrict_demo
from app.core.security import verify_password
from app.models.user import User
from app.schemas.telegram_bridge import (
    CheckSenderRequest,
    CheckSenderResponse,
    VerifyPinRequest,
    VerifyPinResponse,
)
from app.services import pin_rate_limit

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/telegram/auth", tags=["telegram-bridge"])


@router.post("/check-sender", response_model=CheckSenderResponse)
async def check_sender(
    data: CheckSenderRequest,
    current_user: User = Depends(restrict_demo),
):
    """Verify that an incoming Telegram update is from the owner's TG id.

    The bot calls this on every message. 404 means "this Telegram account
    is not whitelisted to use the bridge" — used to drop unauthenticated
    traffic without leaking whether the owner has a bot configured at all.
    """
    if (
        current_user.telegram_user_id is None
        or current_user.telegram_user_id != data.telegram_user_id
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Not whitelisted",
        )
    return CheckSenderResponse(hub_user_id=current_user.id)


@router.post("/verify-pin", response_model=VerifyPinResponse)
async def verify_pin(
    data: VerifyPinRequest,
    current_user: User = Depends(restrict_demo),
):
    """Check a 4–8 digit PIN against ``users.telegram_pin_hash``.

    Rate-limited per user_id: 5 failures / 10 min → 15 min lockout. The
    in-memory limiter resets on process restart, which is acceptable for
    single-tenant / single-process deployments.
    """
    locked, seconds_left = pin_rate_limit.is_locked_out(current_user.id)
    if locked:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Locked out. Retry in {int(seconds_left)}s.",
        )
    if current_user.telegram_pin_hash is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="PIN not configured",
        )
    if not verify_password(data.pin, current_user.telegram_pin_hash):
        pin_rate_limit.record_failure(current_user.id)
        log.info("pin verify failed user=%s", current_user.id)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Wrong PIN",
        )
    pin_rate_limit.record_success(current_user.id)
    return VerifyPinResponse(ok=True)
