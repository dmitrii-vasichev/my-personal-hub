"""Birthday CRUD service — create, list, update, delete."""

from datetime import date
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.birthday import Birthday
from app.models.user import User


def next_birthday_date(birth_date: date, today: date | None = None) -> date:
    """Calculate the next upcoming birthday from today."""
    if today is None:
        today = date.today()
    month, day = birth_date.month, birth_date.day
    for year in (today.year, today.year + 1):
        try:
            candidate = date(year, month, day)
        except ValueError:
            # Feb 29 in a non-leap year → fall back to Feb 28
            candidate = date(year, month, 28)
        if candidate >= today:
            return candidate
    return date(today.year + 1, month, min(day, 28))


def days_until(next_birthday: date) -> int:
    """Calculate days until the next birthday."""
    return (next_birthday - date.today()).days


async def create_birthday(
    db: AsyncSession,
    user: User,
    name: str,
    birth_date: date,
    advance_days: int = 3,
    reminder_time=None,
) -> Birthday:
    from datetime import time as _time

    birthday = Birthday(
        user_id=user.id,
        name=name,
        birth_date=birth_date,
        advance_days=advance_days,
        reminder_time=reminder_time or _time(10, 0),
    )
    db.add(birthday)
    await db.commit()
    await db.refresh(birthday)
    return birthday


async def list_birthdays(
    db: AsyncSession,
    user: User,
) -> list[Birthday]:
    """List all birthdays for a user, sorted by next upcoming date."""
    result = await db.execute(
        select(Birthday)
        .where(Birthday.user_id == user.id)
        .order_by(Birthday.birth_date)
    )
    birthdays = list(result.scalars().all())
    # Sort by next upcoming birthday date
    birthdays.sort(key=lambda b: next_birthday_date(b.birth_date))
    return birthdays


async def get_birthday(
    db: AsyncSession,
    birthday_id: int,
    user: User,
) -> Optional[Birthday]:
    result = await db.execute(
        select(Birthday).where(
            Birthday.id == birthday_id, Birthday.user_id == user.id
        )
    )
    return result.scalar_one_or_none()


async def update_birthday(
    db: AsyncSession,
    birthday_id: int,
    user: User,
    **kwargs: object,
) -> Optional[Birthday]:
    birthday = await get_birthday(db, birthday_id, user)
    if not birthday:
        return None
    for key, value in kwargs.items():
        setattr(birthday, key, value)
    await db.commit()
    await db.refresh(birthday)
    return birthday


async def delete_birthday(
    db: AsyncSession,
    birthday_id: int,
    user: User,
) -> bool:
    birthday = await get_birthday(db, birthday_id, user)
    if not birthday:
        return False
    await db.delete(birthday)
    await db.commit()
    return True
