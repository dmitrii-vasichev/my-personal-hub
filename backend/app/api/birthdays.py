"""Birthday API endpoints."""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, restrict_demo
from app.core.timezone import user_today
from app.models.user import User
from app.schemas.birthday import BirthdayCreate, BirthdayResponse, BirthdayUpdate
from app.services import birthdays as birthday_service
from app.services.birthdays import days_until, next_birthday_date

router = APIRouter(prefix="/api/reminders/birthdays", tags=["birthdays"])


def _to_response(b, today: date) -> BirthdayResponse:
    next_bd = next_birthday_date(b.birth_date, today=today)
    return BirthdayResponse(
        id=b.id,
        user_id=b.user_id,
        name=b.name,
        birth_date=b.birth_date,
        advance_days=b.advance_days,
        reminder_time=b.reminder_time,
        next_birthday=next_bd,
        days_until=days_until(next_bd, today=today),
        created_at=b.created_at,
        updated_at=b.updated_at,
    )


@router.get("/", response_model=list[BirthdayResponse])
async def list_birthdays(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = await user_today(db, current_user.id)
    birthdays = await birthday_service.list_birthdays(db, current_user)
    return [_to_response(b, today) for b in birthdays]


@router.post("/", response_model=BirthdayResponse, status_code=status.HTTP_201_CREATED)
async def create_birthday(
    data: BirthdayCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(restrict_demo),
):
    birthday = await birthday_service.create_birthday(
        db,
        current_user,
        name=data.name,
        birth_date=data.birth_date,
        advance_days=data.advance_days,
        reminder_time=data.reminder_time,
    )
    today = await user_today(db, current_user.id)
    return _to_response(birthday, today)


@router.patch("/{birthday_id}", response_model=BirthdayResponse)
async def update_birthday(
    birthday_id: int,
    data: BirthdayUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(restrict_demo),
):
    birthday = await birthday_service.update_birthday(
        db,
        birthday_id,
        current_user,
        **data.model_dump(exclude_unset=True),
    )
    if not birthday:
        raise HTTPException(status_code=404, detail="Birthday not found")
    today = await user_today(db, current_user.id)
    return _to_response(birthday, today)


@router.delete("/{birthday_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_birthday(
    birthday_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(restrict_demo),
):
    deleted = await birthday_service.delete_birthday(db, birthday_id, current_user)
    if not deleted:
        raise HTTPException(status_code=404, detail="Birthday not found")
