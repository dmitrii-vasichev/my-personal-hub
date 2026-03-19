"""Service for acting on structured digest items: to_task, to_note, to_job, skip."""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.job import Job
from app.models.telegram import PulseDigestItem
from app.models.user import User
from app.schemas.task import TaskCreate
from app.services import note as note_service
from app.services import task as task_service
from app.services import google_oauth
from app.services.settings import get_or_create_settings

logger = logging.getLogger(__name__)

VALID_ACTIONS = ("to_task", "to_note", "to_job", "skip")


async def process_item_action(
    db: AsyncSession,
    user: User,
    item_id: int,
    action: str,
) -> dict | None:
    """Process a single digest item action.

    Returns result dict on success, None if item not found.
    Raises ValueError for invalid action or missing prerequisites.
    """
    if action not in VALID_ACTIONS:
        raise ValueError(f"Invalid action: {action}. Must be one of {VALID_ACTIONS}")

    result = await db.execute(
        select(PulseDigestItem).where(
            PulseDigestItem.id == item_id,
            PulseDigestItem.user_id == user.id,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        return None

    now = datetime.now(timezone.utc)
    created_id = None

    if action == "to_task":
        task_data = TaskCreate(
            title=f"[Pulse] {item.title}",
            description=item.summary,
        )
        task = await task_service.create_task(db, task_data, user)
        created_id = task.id
        item.status = "actioned"

    elif action == "to_note":
        credentials = await google_oauth.get_credentials(db, user)
        if not credentials:
            raise ValueError("Google credentials not configured")
        settings = await get_or_create_settings(db, user)
        folder_id = settings.google_drive_notes_folder_id
        if not folder_id:
            raise ValueError("Notes folder not configured in Settings")

        note = await note_service.create_note(
            db, user, f"Pulse: {item.title}", item.summary, credentials, folder_id
        )
        created_id = note.id
        item.status = "actioned"

    elif action == "to_job":
        meta = item.metadata_ or {}
        # Parse salary range if present
        salary_min, salary_max = _parse_salary_range(meta.get("salary_range"))

        job = Job(
            user_id=user.id,
            title=meta.get("position") or item.title,
            company=meta.get("company") or "Unknown",
            location=meta.get("location"),
            url=meta.get("url"),
            source="pulse",
            description=item.summary,
            salary_min=salary_min,
            salary_max=salary_max,
            found_at=now,
        )
        db.add(job)
        await db.flush()
        created_id = job.id
        item.status = "actioned"

    elif action == "skip":
        item.status = "skipped"

    item.actioned_at = now
    item.action_type = action
    if created_id is not None:
        item.action_result_id = created_id

    await db.commit()

    logger.info(
        "Digest item %s action=%s for user %s (result_id=%s)",
        item_id, action, user.id, created_id,
    )

    return {
        "status": "ok",
        "action": action,
        "item_id": item_id,
        "created_id": created_id,
    }


async def bulk_item_action(
    db: AsyncSession,
    user: User,
    item_ids: list[int],
    action: str,
) -> dict:
    """Process bulk action on multiple digest items."""
    if action not in VALID_ACTIONS:
        raise ValueError(f"Invalid action: {action}. Must be one of {VALID_ACTIONS}")

    processed = 0
    for item_id in item_ids:
        result = await process_item_action(db, user, item_id, action)
        if result is not None:
            processed += 1

    return {"status": "ok", "action": action, "processed": processed}


def _parse_salary_range(salary_str: str | None) -> tuple[int | None, int | None]:
    """Parse salary range string like '$150k-$200k' into (min, max) integers."""
    if not salary_str:
        return None, None

    import re

    # Match patterns like: $150k-$200k, 150000-200000, $150,000
    numbers = re.findall(r"[\d,]+(?:\.\d+)?[kK]?", salary_str)
    if not numbers:
        return None, None

    parsed = []
    for n in numbers[:2]:
        clean = n.replace(",", "")
        if clean.lower().endswith("k"):
            parsed.append(int(float(clean[:-1]) * 1000))
        else:
            parsed.append(int(float(clean)))

    if len(parsed) == 1:
        return parsed[0], parsed[0]
    return parsed[0], parsed[1]
