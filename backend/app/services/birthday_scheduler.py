"""Daily birthday scheduler — auto-generates Reminder records from Birthday entries."""

import logging
from datetime import datetime, timedelta, time as dt_time
from zoneinfo import ZoneInfo

from sqlalchemy import and_, select

from app.models.birthday import Birthday
from app.models.reminder import Reminder, ReminderStatus
from app.models.telegram import PulseSettings
from app.models.user import User
from app.services.birthdays import BIRTHDAY_TITLE_PREFIX, next_birthday_date

logger = logging.getLogger(__name__)


async def run_birthday_check() -> None:
    """
    Daily job: for each birthday where next_birthday is within advance_days,
    check if a reminder already exists for this year. If not, create one.
    """
    from app.core.database import async_session_factory

    async with async_session_factory() as db:
        try:
            # Load all birthdays
            result = await db.execute(select(Birthday))
            birthdays = list(result.scalars().all())
            if not birthdays:
                return

            # Collect unique user_ids and load settings + user objects
            user_ids = {b.user_id for b in birthdays}

            settings_map: dict[int, PulseSettings] = {}
            user_map: dict[int, User] = {}

            for user_id in user_ids:
                ps_result = await db.execute(
                    select(PulseSettings).where(PulseSettings.user_id == user_id)
                )
                ps = ps_result.scalar_one_or_none()
                if ps:
                    settings_map[user_id] = ps

                user_result = await db.execute(
                    select(User).where(User.id == user_id)
                )
                user = user_result.scalar_one_or_none()
                if user:
                    user_map[user_id] = user

            created_count = 0

            for birthday in birthdays:
                user = user_map.get(birthday.user_id)
                if not user:
                    continue

                ps = settings_map.get(birthday.user_id)
                tz_name = ps.timezone if ps else "UTC"
                try:
                    tz = ZoneInfo(tz_name)
                except Exception:
                    tz = ZoneInfo("UTC")

                # Bug 1 fix: compute today per-user using their timezone
                today = datetime.now(tz).date()

                next_bday = next_birthday_date(birthday.birth_date, today=today)
                advance = birthday.advance_days
                reminder_time: dt_time = birthday.reminder_time or dt_time(10, 0)

                days_remaining = (next_bday - today).days
                if days_remaining > advance:
                    # Too early to create a reminder
                    continue

                # Calculate the date the reminder should fire
                reminder_date = next_bday - timedelta(days=advance)
                if reminder_date < today:
                    # Reminder date already passed but birthday hasn't — fire today
                    reminder_date = today

                # Build timezone-aware remind_at
                remind_at = datetime(
                    reminder_date.year,
                    reminder_date.month,
                    reminder_date.day,
                    reminder_time.hour,
                    reminder_time.minute,
                    tzinfo=tz,
                )

                title = f"{BIRTHDAY_TITLE_PREFIX}{birthday.name}"

                # Deduplication: check if a reminder already exists for this
                # birthday occurrence. Anchor window to actual birthday date
                # with a generous range to catch any advance_days setting.
                window_start = datetime(
                    next_bday.year,
                    next_bday.month,
                    next_bday.day,
                    0, 0, 0,
                    tzinfo=tz,
                ) - timedelta(days=30)
                window_end = datetime(
                    next_bday.year,
                    next_bday.month,
                    next_bday.day,
                    0, 0, 0,
                    tzinfo=tz,
                ) + timedelta(days=1)

                existing = await db.execute(
                    select(Reminder).where(
                        and_(
                            Reminder.user_id == birthday.user_id,
                            Reminder.title == title,
                            Reminder.remind_at >= window_start,
                            Reminder.remind_at < window_end,
                        )
                    )
                )
                if existing.scalars().first() is not None:
                    # Reminder already exists for this occurrence
                    continue

                # Create the reminder
                reminder = Reminder(
                    user_id=user.id,
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
                    "Birthday scheduler: created %d reminder(s)", created_count
                )

        except Exception as e:
            await db.rollback()
            logger.error("Birthday check failed: %s", e)
