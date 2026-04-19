from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, require_admin, restrict_demo
from app.models.user import User
from app.schemas.auth import (
    ApiTokenCreate,
    ApiTokenCreateResponse,
    ApiTokenListItem,
    ChangePasswordRequest,
    LoginRequest,
    LoginResponse,
    ProfileResponse,
    RegisterRequest,
    RegisterResponse,
    UpdateProfileRequest,
    UserResponse,
    user_to_response,
)
from app.services import api_token as api_token_service
from app.services.auth import (
    authenticate_user,
    change_user_password,
    create_user,
    generate_token,
    update_last_login,
)
from app.services.timezone import apply_user_timezone_change

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/demo-login", response_model=LoginResponse)
async def demo_login(db: AsyncSession = Depends(get_db)):
    """Authenticate as the demo user without credentials."""
    result = await db.execute(
        select(User).where(User.email == "demo@personalhub.app")
    )
    demo_user = result.scalar_one_or_none()
    if demo_user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Demo user not found",
        )
    await update_last_login(db, demo_user)
    token = generate_token(demo_user)
    return LoginResponse(
        access_token=token,
        must_change_password=False,
    )


@router.post("/login", response_model=LoginResponse)
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    user = await authenticate_user(db, data.email, data.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    if user.is_blocked:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is blocked",
        )
    await update_last_login(db, user)
    token = generate_token(user)
    return LoginResponse(
        access_token=token,
        must_change_password=user.must_change_password,
    )


@router.post("/register", response_model=RegisterResponse)
async def register(
    data: RegisterRequest,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    user, temp_password = await create_user(db, data.email, data.display_name, data.role)
    return RegisterResponse(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        role=user.role.value,
        temporary_password=temp_password,
    )


@router.get("/me", response_model=UserResponse)
async def get_me(user: User = Depends(get_current_user)):
    # Use the explicit shim so ``telegram_pin_configured`` is computed
    # from the bcrypt hash without ever serialising the hash itself.
    return user_to_response(user)


@router.post("/change-password")
async def change_password(
    data: ChangePasswordRequest,
    user: User = Depends(restrict_demo),
    db: AsyncSession = Depends(get_db),
):
    success = await change_user_password(db, user, data.current_password, data.new_password)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )
    return {"message": "Password changed successfully"}


@router.get("/profile", response_model=ProfileResponse)
async def get_profile(user: User = Depends(get_current_user)):
    return user


@router.put("/profile", response_model=ProfileResponse)
async def update_profile(
    data: UpdateProfileRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if data.display_name is not None:
        user.display_name = data.display_name
    if data.theme is not None:
        user.theme = data.theme
    tz_changed = False
    if data.timezone is not None and data.timezone != user.timezone:
        # Value already validated as an IANA name in UpdateProfileRequest.
        user.timezone = data.timezone
        tz_changed = True
    await db.commit()
    await db.refresh(user)
    if tz_changed:
        # Re-register per-user cron jobs (digest, birthday) so they fire
        # at the new local time immediately — otherwise they keep using
        # the pre-change timezone until the backend restarts.
        await apply_user_timezone_change(db, user.id, user.timezone)
    return user


# --- API token management (Phase 2) ----------------------------------------


@router.post(
    "/tokens",
    response_model=ApiTokenCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_api_token(
    payload: ApiTokenCreate,
    user: User = Depends(restrict_demo),
    db: AsyncSession = Depends(get_db),
):
    """Mint a new API token for the authenticated user.

    Raw token is returned exactly once; only its hash is stored.
    """
    try:
        token, raw = await api_token_service.create_token(db, user, payload.name)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Token with this name already exists",
        )
    return ApiTokenCreateResponse(
        id=token.id,
        name=token.name,
        token_prefix=token.token_prefix,
        raw_token=raw,
        created_at=token.created_at,
    )


@router.get("/tokens", response_model=list[ApiTokenListItem])
async def list_api_tokens(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List active (non-revoked) tokens for the current user."""
    tokens = await api_token_service.list_tokens(db, user)
    return tokens


@router.delete("/tokens/{token_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_api_token(
    token_id: int,
    user: User = Depends(restrict_demo),
    db: AsyncSession = Depends(get_db),
):
    """Revoke a token by id. 404 if not found or already revoked."""
    ok = await api_token_service.revoke_token(db, user, token_id)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Token not found",
        )
