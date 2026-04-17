"""Per-user birthday scheduler — creates Reminder records from Birthday entries.

Runs once per day at 00:05 in the user's local timezone (scheduled via
schedule_user_birthday_check). Running in user-local time ensures that when
today becomes the actual reminder day, reminder_time has not yet passed.
"""

import logging
from datetime import datetime, timedelta, time as dt_time
from zoneinfo import ZoneInfo

from sqlalchemy import and_, select

from app.models.birthday import Birthday
from app.models.reminder import Reminder, ReminderStatus
from app.models.telegram import PulseSettings
from app.services.birthdays import BIRTHDAY_TITLE_PREFIX, next_birthday_date

logger = logging.getLogger(__name__)


async def run_user_birthday_check(user_id: int) -> None:
    """Daily per-user job: create pending reminders for upcoming birthdays."""
    from app.core.database import async_session_factory

    async with async_session_factory() as db:
        try:
            ps_result = await db.execute(
                select(PulseSettings).where(PulseSettings.user_id == user_id)
            )
            ps = ps_result.scalar_one_or_none()
            tz_name = ps.timezone if ps else "UTC"
            try:
                tz = ZoneInfo(tz_name)
            except Exception:
                tz = ZoneInfo("UTC")

            result = await db.execute(
                select(Birthday).where(Birthday.user_id == user_id)
            )
            birthdays = list(result.scalars().all())
            if not birthdays:
                return

            today = datetime.now(tz).date()
            created_count = 0

            for birthday in birthdays:
                next_bday = next_birthday_date(birthday.birth_date, today=today)
                advance = birthday.advance_days
                reminder_time: dt_time = birthday.reminder_time or dt_time(10, 0)

                days_remaining = (next_bday - today).days
                if days_remaining > advance:
                    continue

                reminder_date = next_bday - timedelta(days=advance)
                if reminder_date < today:
                    reminder_date = today

                remind_at = datetime(
                    reminder_date.year,
                    reminder_date.month,
                    reminder_date.day,
                    reminder_time.hour,
                    reminder_time.minute,
                    tzinfo=tz,
                )

                title = f"{BIRTHDAY_TITLE_PREFIX}{birthday.name}"

                window_start = datetime(
                    next_bday.year, next_bday.month, next_bday.day,
                    0, 0, 0, tzinfo=tz,
                ) - timedelta(days=30)
                window_end = datetime(
                    next_bday.year, next_bday.month, next_bday.day,
                    0, 0, 0, tzinfo=tz,
                ) + timedelta(days=1)

                existing = await db.execute(
                    select(Reminder).where(
                        and_(
                            Reminder.user_id == user_id,
                            Reminder.title == title,
                            Reminder.remind_at >= window_start,
                            Reminder.remind_at < window_end,
                        )
                    )
                )
                if existing.scalars().first() is not None:
                    continue

                reminder = Reminder(
                    user_id=user_id,
                    title=title,
                    remind_at=remind_at,
                    status=ReminderStatus.pending,
                    recurrence_rule=None,
                )
                db.add(reminder)
                created_count += 1

            if created_count:
                await db.commit()
                logger.info(
                    "Birthday check for user %s: created %d reminder(s)",
                    user_id, created_count,
                )

        except Exception as e:
            await db.rollback()
            logger.error("Birthday check for user %s failed: %s", user_id, e)
