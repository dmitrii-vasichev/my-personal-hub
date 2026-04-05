"""
Task reminder service — query, dismiss, and notify reminders via Telegram.
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.task import Task, TaskStatus
from app.models.user import User

logger = logging.getLogger(__name__)


async def get_due_reminders(db: AsyncSession, user: User) -> list[Task]:
    """Return tasks with reminder_at within the past or next 15 minutes, not dismissed."""
    now = datetime.now(tz=timezone.utc)
    window_end = now + timedelta(minutes=15)

    result = await db.execute(
        select(Task)
        .where(
            and_(
                Task.user_id == user.id,
                Task.reminder_at <= window_end,
                Task.reminder_dismissed.is_(False),
                Task.status.notin_([TaskStatus.done, TaskStatus.cancelled]),
            )
        )
        .order_by(Task.reminder_at)
    )
    return list(result.scalars().all())


async def dismiss_reminder(
    db: AsyncSession, task_id: int, user: User
) -> Optional[Task]:
    """Mark reminder_dismissed = True for the task. Returns None if not found/accessible."""
    result = await db.execute(
        select(Task).where(Task.id == task_id, Task.user_id == user.id)
    )
    task = result.scalar_one_or_none()
    if task is None:
        return None

    task.reminder_dismissed = True
    await db.commit()
    await db.refresh(task)
    return task


async def run_reminder_check() -> None:
    """Scheduled job: check all users for due reminders and send Telegram notifications."""
    from app.core.database import async_session_factory
    from app.core.encryption import decrypt_value
    from app.models.telegram import PulseSettings
    from app.services.telegram_notifications import send_task_reminder_notification

    async with async_session_factory() as db:
        try:
            now = datetime.now(tz=timezone.utc)

            # Find all due, non-dismissed reminders across all users
            result = await db.execute(
                select(Task)
                .where(
                    and_(
                        Task.reminder_at <= now,
                        Task.reminder_dismissed.is_(False),
                        Task.status.notin_([TaskStatus.done, TaskStatus.cancelled]),
                    )
                )
            )
            tasks = list(result.scalars().all())
            if not tasks:
                return

            # Group by user_id
            by_user: dict[int, list[Task]] = {}
            for t in tasks:
                by_user.setdefault(t.user_id, []).append(t)

            for user_id, user_tasks in by_user.items():
                # Get Telegram bot credentials
                ps_result = await db.execute(
                    select(PulseSettings).where(PulseSettings.user_id == user_id)
                )
                ps = ps_result.scalar_one_or_none()
                if not ps or not ps.bot_token or not ps.bot_chat_id:
                    continue

                token = decrypt_value(ps.bot_token)
                tz_name = ps.timezone or "UTC"

                for task in user_tasks:
                    # Format reminder_at in user's timezone
                    try:
                        from zoneinfo import ZoneInfo
                        local_dt = task.reminder_at.astimezone(ZoneInfo(tz_name))
                        time_str = local_dt.strftime("%b %d, %Y %I:%M %p")
                    except Exception:
                        time_str = task.reminder_at.strftime("%b %d, %Y %H:%M UTC")

                    res = await send_task_reminder_notification(
                        token, ps.bot_chat_id, task.title, time_str
                    )
                    if res["success"]:
                        task.reminder_dismissed = True

                await db.commit()
                logger.info(
                    "Sent %d reminder notification(s) for user %s",
                    len(user_tasks), user_id,
                )

        except Exception as e:
            logger.error("Reminder check failed: %s", e)
