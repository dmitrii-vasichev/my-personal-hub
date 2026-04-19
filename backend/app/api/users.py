import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, require_admin, restrict_demo
from app.core.security import hash_password
from app.models.user import User, UserRole
from app.schemas.auth import (
    CreateUserRequest,
    RegisterResponse,
    ResetPasswordResponse,
    UpdateUserRequest,
    UserResponse,
    user_to_response,
)
from app.schemas.telegram_bridge import (
    TelegramPinUpdateRequest,
    TelegramUserIdUpdateRequest,
)
from app.services.auth import create_user
from app.services.timezone import apply_user_timezone_change

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/", response_model=list[UserResponse])
async def list_users(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    result = await db.execute(select(User).order_by(User.id))
    return [user_to_response(u) for u in result.scalars().all()]


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user_to_response(user)


@router.post("/", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
async def create_user_endpoint(
    data: CreateUserRequest,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    # Check for duplicate email
    result = await db.execute(select(User).where(User.email == data.email))
    if result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User with this email already exists",
        )
    user, temp_password = await create_user(
        db,
        data.email,
        data.display_name,
        data.role,
        timezone_name=data.timezone,
    )
    return RegisterResponse(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        role=user.role.value,
        temporary_password=temp_password,
    )


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    data: UpdateUserRequest,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if data.role is not None:
        try:
            user.role = UserRole(data.role)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid role: {data.role}",
            )
    if data.is_blocked is not None:
        user.is_blocked = data.is_blocked
    tz_changed = False
    if data.timezone is not None and data.timezone != user.timezone:
        # Already validated as IANA in UpdateUserRequest.
        user.timezone = data.timezone
        tz_changed = True

    await db.commit()
    await db.refresh(user)
    if tz_changed:
        # Re-register per-user cron jobs (digest, birthday) so they fire
        # at the new local time immediately — otherwise they keep using
        # the pre-change timezone until the backend restarts.
        await apply_user_timezone_change(db, user.id, user.timezone)
    return user_to_response(user)


@router.post("/{user_id}/reset-password", response_model=ResetPasswordResponse)
async def reset_password(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    temp_password = secrets.token_urlsafe(12)
    user.password_hash = hash_password(temp_password)
    user.must_change_password = True
    await db.commit()
    return ResetPasswordResponse(temporary_password=temp_password)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    if admin.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account",
        )
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    await db.delete(user)
    await db.commit()


@router.post("/demo/reset")
async def reset_demo_data(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete all demo user data and re-seed with defaults. Admin or demo user."""
    if current_user.role not in (UserRole.admin, UserRole.demo):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin or demo user can reset demo data",
        )
    from app.scripts.seed_demo import (
        cleanup_demo_user,
        create_demo_user,
        create_events,
        create_jobs,
        create_kb_docs,
        create_notes,
        create_profile,
        create_pulse_data,
        create_tags,
        create_tasks,
        create_vitals_data,
    )

    await cleanup_demo_user(db)

    user = await create_demo_user(db)
    await create_profile(db, user.id)
    tags = await create_tags(db, user.id)
    await create_tasks(db, user.id, tags)
    await create_jobs(db, user.id)
    await create_events(db, user.id)
    await create_kb_docs(db, user.id)
    await create_notes(db, user.id)
    await create_pulse_data(db, user.id)
    await create_vitals_data(db, user.id)

    await db.commit()

    return {"status": "ok", "message": "Demo data reset successfully"}


# --- Telegram→CC bridge (Phase 2): owner-only self-service ------------------
#
# These two PUTs let the authenticated user set/rotate their own PIN and TG
# user id for the Telegram bridge. They live on the ``/api/users`` router
# (not the new ``/api/telegram/auth`` router) because they mutate
# ``users.*`` rows — the bridge router is read-only against the user table.


@router.put("/me/telegram-pin", status_code=status.HTTP_204_NO_CONTENT)
async def update_my_telegram_pin(
    data: TelegramPinUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(restrict_demo),
):
    """Set or rotate the owner's Telegram PIN. Stored bcrypt-hashed."""
    current_user.telegram_pin_hash = hash_password(data.pin)
    await db.commit()


@router.put("/me/telegram-user-id", status_code=status.HTTP_204_NO_CONTENT)
async def update_my_telegram_user_id(
    data: TelegramUserIdUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(restrict_demo),
):
    """Set or rotate the owner's ``users.telegram_user_id`` column.

    The column has a UNIQUE constraint; collisions are impossible in
    single-tenant mode but we still catch ``IntegrityError`` to return
    a clean 409 instead of a 500 if anything racy happens.
    """
    current_user.telegram_user_id = data.telegram_user_id
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="telegram_user_id already in use",
        )
