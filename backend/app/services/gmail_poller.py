"""
Gmail reply polling service.

Checks tracked Gmail threads for new inbound replies,
logs them as activities, and auto-transitions lead statuses.
"""
from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session_factory
from app.models.outreach import ActivityType, Lead, LeadActivity, LeadStatus, LeadStatusHistory
from app.models.user import User, UserRole
from app.services.google_gmail import get_thread_replies
from app.services.google_oauth import get_credentials

logger = logging.getLogger(__name__)

# Statuses that auto-transition to "responded" on inbound reply
_AUTO_RESPOND_STATUSES = {LeadStatus.contacted.value, LeadStatus.follow_up.value}


async def poll_gmail_replies(db: AsyncSession, user: User) -> dict:
    """Poll all tracked Gmail threads for new replies.

    Returns summary: {"threads_checked": int, "new_replies": int, "status_transitions": int}
    """
    creds = await get_credentials(db, user)
    if not creds:
        return {"threads_checked": 0, "new_replies": 0, "error": "No Google credentials"}

    # Get all distinct gmail_thread_ids from activities
    result = await db.execute(
        select(LeadActivity.gmail_thread_id, LeadActivity.lead_id)
        .where(
            LeadActivity.gmail_thread_id.isnot(None),
            LeadActivity.gmail_thread_id != "",
        )
        .distinct(LeadActivity.gmail_thread_id)
    )
    thread_leads: dict[str, int] = {}
    for row in result.all():
        thread_leads[row[0]] = row[1]

    if not thread_leads:
        return {"threads_checked": 0, "new_replies": 0}

    # Get all known gmail_message_ids to skip
    msg_result = await db.execute(
        select(LeadActivity.gmail_message_id)
        .where(LeadActivity.gmail_message_id.isnot(None))
    )
    known_ids = {row[0] for row in msg_result.all()}

    total_new = 0
    total_transitions = 0

    for thread_id, lead_id in thread_leads.items():
        try:
            new_messages = await get_thread_replies(creds, thread_id, known_ids)
        except Exception as e:
            logger.warning("Failed to poll thread %s: %s", thread_id, e)
            continue

        for msg in new_messages:
            activity = LeadActivity(
                lead_id=lead_id,
                activity_type=ActivityType.inbound_email.value,
                subject=msg["subject"],
                body=msg["body"],
                gmail_message_id=msg["message_id"],
                gmail_thread_id=thread_id,
            )
            db.add(activity)
            known_ids.add(msg["message_id"])
            total_new += 1

        # Auto-status transition on new inbound replies
        if new_messages:
            lead = await db.get(Lead, lead_id)
            if lead and lead.status in _AUTO_RESPOND_STATUSES:
                old_status = lead.status
                lead.status = LeadStatus.responded.value
                from datetime import datetime, timezone
                lead.updated_at = datetime.now(timezone.utc)
                history = LeadStatusHistory(
                    lead_id=lead.id,
                    old_status=old_status,
                    new_status=LeadStatus.responded.value,
                    comment="Auto: reply received via Gmail",
                )
                db.add(history)
                total_transitions += 1

    await db.commit()

    return {
        "threads_checked": len(thread_leads),
        "new_replies": total_new,
        "status_transitions": total_transitions,
    }


async def run_gmail_poll() -> None:
    """Scheduled job: poll Gmail replies for all non-demo users with Google OAuth."""
    async with async_session_factory() as db:
        try:
            result = await db.execute(
                select(User).where(User.role != UserRole.demo)
            )
            users = result.scalars().all()

            for user in users:
                try:
                    summary = await poll_gmail_replies(db, user)
                    if summary.get("new_replies", 0) > 0:
                        logger.info(
                            "Gmail poll user %s: %d new replies, %d status transitions",
                            user.id, summary["new_replies"], summary.get("status_transitions", 0),
                        )
                except Exception as e:
                    logger.error("Gmail poll failed for user %s: %s", user.id, e)
        except Exception as e:
            logger.error("Gmail poll job failed: %s", e)
