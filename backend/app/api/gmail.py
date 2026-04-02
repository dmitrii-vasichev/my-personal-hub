"""Gmail integration API endpoints."""
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from googleapiclient.errors import HttpError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, restrict_demo
from app.models.user import User
from app.schemas.outreach import ActivityResponse, SendEmailRequest
from app.services import google_oauth as oauth_service
from app.services import outreach as outreach_service
from app.services.gmail_poller import poll_gmail_replies

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/gmail", tags=["gmail"])


@router.get("/status")
async def gmail_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Check Gmail connection status and whether Gmail scopes are granted."""
    oauth_status = await oauth_service.get_status(db, current_user)
    return {
        "connected": oauth_status["connected"],
        "gmail_available": oauth_status.get("gmail_available", False),
        "needs_reauth": oauth_status["connected"] and not oauth_status.get("gmail_available", False),
    }


@router.post(
    "/leads/{lead_id}/send-email",
    response_model=ActivityResponse,
    status_code=status.HTTP_201_CREATED,
)
async def send_email_to_lead(
    lead_id: int,
    data: SendEmailRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(restrict_demo),
):
    """Send email to a lead via Gmail and auto-log as activity."""
    creds = await oauth_service.get_credentials(db, current_user)
    if not creds:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google account not connected. Please connect via Settings.",
        )

    try:
        activity = await outreach_service.send_email_to_lead(
            db, lead_id, data, current_user, creds
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HttpError as e:
        logger.error("Gmail API error for lead %s: %s", lead_id, e)
        detail = e._get_reason() or str(e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Gmail API error: {detail}",
        )
    except Exception as e:
        logger.error("Failed to send email to lead %s: %s", lead_id, e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to send email via Gmail: {e}",
        )

    if activity is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")

    return activity


@router.post("/check-replies")
async def check_replies(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(restrict_demo),
):
    """Manually trigger Gmail reply polling for the current user."""
    creds = await oauth_service.get_credentials(db, current_user)
    if not creds:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google account not connected.",
        )

    summary = await poll_gmail_replies(db, current_user)
    return summary
