"""
Batch outreach service — prepare, send, pause, cancel batch email jobs.

Flow:
  1. prepare_batch() → filter leads, generate missing proposals, create job + items
  2. start_batch_send() → launch asyncio background task with rate-limited sending
  3. pause/cancel → update job status, background task checks on each iteration
"""
from __future__ import annotations

import asyncio
import logging
import random
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import async_session_factory
from app.models.outreach import (
    ActivityType,
    BatchItemStatus,
    BatchJobStatus,
    BatchOutreachItem,
    BatchOutreachJob,
    Lead,
    LeadActivity,
    LeadStatus,
    LeadStatusHistory,
)
from app.models.user import User
from app.schemas.outreach import (
    BatchItemPreview,
    BatchItemUpdate,
    BatchPrepareRequest,
)
from app.services.google_gmail import send_email
from app.services.google_oauth import get_credentials
from app.services.lead_proposal import generate_proposal

logger = logging.getLogger(__name__)

# Rate limiting: 2–3 min random delay between emails
_MIN_DELAY_SEC = 120
_MAX_DELAY_SEC = 180

# Track running tasks so we can cancel them
_running_tasks: dict[int, asyncio.Task] = {}


async def prepare_batch(
    db: AsyncSession,
    data: BatchPrepareRequest,
    current_user: User,
) -> dict:
    """Filter leads, generate missing proposals, create job + preview items.

    Returns: {"job_id", "items", "total", "skipped_no_email", "skipped_no_proposal"}
    """
    # Build filter query
    query = select(Lead).where(Lead.user_id == current_user.id)

    if data.status:
        query = query.where(Lead.status.in_(data.status))
    else:
        # Default: only "new" leads for batch outreach
        query = query.where(Lead.status == LeadStatus.new.value)

    if data.industry_id:
        query = query.where(Lead.industry_id == data.industry_id)

    query = query.options(selectinload(Lead.industry))
    result = await db.execute(query)
    leads = list(result.scalars().all())

    skipped_no_email = 0
    skipped_no_proposal = 0
    preview_items: list[BatchItemPreview] = []

    for lead in leads:
        if not lead.email:
            skipped_no_email += 1
            continue

        if not lead.proposal_text:
            # Try generating proposal
            try:
                updated_lead = await generate_proposal(db, current_user, lead.id)
                if updated_lead and updated_lead.proposal_text:
                    lead = updated_lead
                else:
                    skipped_no_proposal += 1
                    continue
            except Exception as e:
                logger.warning("Failed to generate proposal for lead %d: %s", lead.id, e)
                skipped_no_proposal += 1
                continue

        subject = (
            lead.proposal_subject
            if lead.proposal_subject
            else data.subject_template.replace("{business_name}", lead.business_name)
        )

        preview_items.append(BatchItemPreview(
            lead_id=lead.id,
            business_name=lead.business_name,
            email=lead.email,
            industry_name=lead.industry.name if lead.industry else None,
            subject=subject,
            body=lead.proposal_text,
            included=True,
        ))

    # Create job in "preparing" status
    job = BatchOutreachJob(
        user_id=current_user.id,
        status=BatchJobStatus.preparing.value,
        total_count=len(preview_items),
    )
    db.add(job)
    await db.flush()

    # Create items
    for item in preview_items:
        db_item = BatchOutreachItem(
            job_id=job.id,
            lead_id=item.lead_id,
            subject=item.subject,
            body=item.body,
            status=BatchItemStatus.queued.value,
        )
        db.add(db_item)

    await db.commit()

    return {
        "job_id": job.id,
        "items": preview_items,
        "total": len(preview_items),
        "skipped_no_email": skipped_no_email,
        "skipped_no_proposal": skipped_no_proposal,
    }


async def start_batch_send(
    db: AsyncSession,
    job_id: int,
    items: list[BatchItemUpdate],
    current_user: User,
) -> BatchOutreachJob | None:
    """Apply user edits to items, then launch background send task.

    Returns the updated job, or None if not found / no access.
    """
    job = await db.get(BatchOutreachJob, job_id)
    if job is None or job.user_id != current_user.id:
        return None

    if job.status not in (BatchJobStatus.preparing.value, BatchJobStatus.paused.value):
        raise ValueError(f"Cannot start job in status '{job.status}'")

    # Build included set and updates
    included_leads = {i.lead_id for i in items if i.included}

    # Update items from user edits
    result = await db.execute(
        select(BatchOutreachItem).where(BatchOutreachItem.job_id == job_id)
    )
    db_items = {i.lead_id: i for i in result.scalars().all()}

    for item_update in items:
        db_item = db_items.get(item_update.lead_id)
        if not db_item:
            continue

        if item_update.lead_id not in included_leads:
            db_item.status = BatchItemStatus.skipped.value
        else:
            if item_update.subject:
                db_item.subject = item_update.subject
            if item_update.body:
                db_item.body = item_update.body
            # Reset to queued if was previously skipped/failed
            if db_item.status in (
                BatchItemStatus.skipped.value,
                BatchItemStatus.failed.value,
            ):
                db_item.status = BatchItemStatus.queued.value

    # Update job counts
    included_count = sum(
        1 for i in db_items.values()
        if i.status == BatchItemStatus.queued.value
    )
    job.total_count = included_count
    job.sent_count = 0
    job.failed_count = 0
    job.status = BatchJobStatus.sending.value

    await db.commit()

    # Launch background task
    task = asyncio.create_task(_process_batch(job_id, current_user.id))
    _running_tasks[job_id] = task

    return job


async def get_batch_job(
    db: AsyncSession, job_id: int, current_user: User
) -> dict | None:
    """Get batch job status with per-item details."""
    job = await db.get(BatchOutreachJob, job_id)
    if job is None or job.user_id != current_user.id:
        return None

    result = await db.execute(
        select(BatchOutreachItem)
        .where(BatchOutreachItem.job_id == job_id)
        .options(selectinload(BatchOutreachItem.lead))
        .order_by(BatchOutreachItem.created_at)
    )
    items = result.scalars().all()

    return {
        "id": job.id,
        "status": job.status,
        "total_count": job.total_count,
        "sent_count": job.sent_count,
        "failed_count": job.failed_count,
        "created_at": job.created_at,
        "updated_at": job.updated_at,
        "items": [
            {
                "id": i.id,
                "lead_id": i.lead_id,
                "subject": i.subject,
                "body": i.body,
                "status": i.status,
                "error_message": i.error_message,
                "sent_at": i.sent_at,
                "lead_business_name": i.lead.business_name if i.lead else None,
            }
            for i in items
        ],
    }


async def pause_batch(
    db: AsyncSession, job_id: int, current_user: User
) -> BatchOutreachJob | None:
    """Pause a running batch job."""
    job = await db.get(BatchOutreachJob, job_id)
    if job is None or job.user_id != current_user.id:
        return None

    if job.status != BatchJobStatus.sending.value:
        raise ValueError(f"Cannot pause job in status '{job.status}'")

    job.status = BatchJobStatus.paused.value
    await db.commit()
    return job


async def cancel_batch(
    db: AsyncSession, job_id: int, current_user: User
) -> BatchOutreachJob | None:
    """Cancel a batch job. Remaining queued items become skipped."""
    job = await db.get(BatchOutreachJob, job_id)
    if job is None or job.user_id != current_user.id:
        return None

    if job.status not in (
        BatchJobStatus.sending.value,
        BatchJobStatus.paused.value,
        BatchJobStatus.preparing.value,
    ):
        raise ValueError(f"Cannot cancel job in status '{job.status}'")

    job.status = BatchJobStatus.cancelled.value

    # Mark remaining queued items as skipped
    result = await db.execute(
        select(BatchOutreachItem).where(
            BatchOutreachItem.job_id == job_id,
            BatchOutreachItem.status == BatchItemStatus.queued.value,
        )
    )
    for item in result.scalars().all():
        item.status = BatchItemStatus.skipped.value

    await db.commit()

    # Cancel background task if running
    task = _running_tasks.pop(job_id, None)
    if task and not task.done():
        task.cancel()

    return job


async def _process_batch(job_id: int, user_id: int) -> None:
    """Background task: send emails one by one with rate limiting.

    Uses its own DB session. Checks job status before each send
    to honor pause/cancel.
    """
    async with async_session_factory() as db:
        try:
            user = await db.get(User, user_id)
            if not user:
                logger.error("Batch job %d: user %d not found", job_id, user_id)
                return

            credentials = await get_credentials(db, user)
            if not credentials:
                job = await db.get(BatchOutreachJob, job_id)
                if job:
                    job.status = BatchJobStatus.failed.value
                    await db.commit()
                logger.error("Batch job %d: no Google credentials", job_id)
                return

            # Get queued items
            result = await db.execute(
                select(BatchOutreachItem)
                .where(
                    BatchOutreachItem.job_id == job_id,
                    BatchOutreachItem.status == BatchItemStatus.queued.value,
                )
                .order_by(BatchOutreachItem.created_at)
            )
            items = list(result.scalars().all())

            for idx, item in enumerate(items):
                # Re-check job status before each send
                job = await db.get(BatchOutreachJob, job_id)
                if not job or job.status != BatchJobStatus.sending.value:
                    logger.info("Batch job %d: stopped (status=%s)", job_id, job.status if job else "deleted")
                    break

                # Send email
                item.status = BatchItemStatus.sending.value
                await db.commit()

                lead = await db.get(Lead, item.lead_id)
                if not lead or not lead.email:
                    item.status = BatchItemStatus.failed.value
                    item.error_message = "Lead has no email"
                    job.failed_count += 1
                    await db.commit()
                    continue

                try:
                    gmail_result = await send_email(
                        credentials=credentials,
                        to=lead.email,
                        subject=item.subject,
                        body=item.body,
                    )

                    # Mark sent
                    item.status = BatchItemStatus.sent.value
                    item.sent_at = datetime.now(timezone.utc)
                    job.sent_count += 1

                    # Create activity
                    activity = LeadActivity(
                        lead_id=item.lead_id,
                        activity_type=ActivityType.outbound_email.value,
                        subject=item.subject,
                        body=item.body,
                        gmail_message_id=gmail_result["message_id"],
                        gmail_thread_id=gmail_result["thread_id"],
                    )
                    db.add(activity)

                    # Auto-status: new → contacted
                    if lead.status == LeadStatus.new.value:
                        old_status = lead.status
                        lead.status = LeadStatus.contacted.value
                        lead.updated_at = datetime.now(timezone.utc)
                        history = LeadStatusHistory(
                            lead_id=lead.id,
                            old_status=old_status,
                            new_status=LeadStatus.contacted.value,
                            comment="Auto: batch email sent",
                        )
                        db.add(history)

                    await db.commit()

                except Exception as e:
                    logger.error(
                        "Batch job %d item %d: send failed: %s", job_id, item.id, e
                    )
                    item.status = BatchItemStatus.failed.value
                    item.error_message = str(e)[:500]
                    job.failed_count += 1
                    await db.commit()

                # Rate limiting delay (skip after last item)
                if idx < len(items) - 1:
                    delay = random.uniform(_MIN_DELAY_SEC, _MAX_DELAY_SEC)
                    logger.info(
                        "Batch job %d: sent %d/%d, sleeping %.0fs",
                        job_id, idx + 1, len(items), delay,
                    )
                    await asyncio.sleep(delay)

            # Finalize job
            job = await db.get(BatchOutreachJob, job_id)
            if job and job.status == BatchJobStatus.sending.value:
                job.status = BatchJobStatus.completed.value
                await db.commit()
                logger.info(
                    "Batch job %d completed: %d sent, %d failed",
                    job_id, job.sent_count, job.failed_count,
                )

        except asyncio.CancelledError:
            logger.info("Batch job %d: task cancelled", job_id)
        except Exception as e:
            logger.error("Batch job %d: unexpected error: %s", job_id, e)
            try:
                job = await db.get(BatchOutreachJob, job_id)
                if job:
                    job.status = BatchJobStatus.failed.value
                    await db.commit()
            except Exception:
                pass
        finally:
            _running_tasks.pop(job_id, None)


async def resume_incomplete_jobs() -> None:
    """Resume batch jobs that were 'sending' when backend restarted.

    Called from app lifespan on startup.
    """
    async with async_session_factory() as db:
        result = await db.execute(
            select(BatchOutreachJob).where(
                BatchOutreachJob.status == BatchJobStatus.sending.value
            )
        )
        jobs = result.scalars().all()

        for job in jobs:
            logger.info("Resuming batch job %d (user %d)", job.id, job.user_id)
            task = asyncio.create_task(_process_batch(job.id, job.user_id))
            _running_tasks[job.id] = task
