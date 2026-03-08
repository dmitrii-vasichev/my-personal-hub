from __future__ import annotations

import secrets

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password, verify_password, create_access_token
from app.models.user import User, UserRole


async def authenticate_user(db: AsyncSession, email: str, password: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user is None or not verify_password(password, user.password_hash):
        return None
    return user


async def create_user(
    db: AsyncSession,
    email: str,
    display_name: str,
    role: str = "user",
) -> tuple[User, str]:
    temp_password = secrets.token_urlsafe(12)
    user = User(
        email=email,
        password_hash=hash_password(temp_password),
        display_name=display_name,
        role=UserRole(role),
        must_change_password=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user, temp_password


async def change_user_password(
    db: AsyncSession, user: User, current_password: str, new_password: str
) -> bool:
    if not verify_password(current_password, user.password_hash):
        return False
    user.password_hash = hash_password(new_password)
    user.must_change_password = False
    await db.commit()
    return True


def generate_token(user: User) -> str:
    return create_access_token(user.id, user.role.value)


async def get_user_by_id(db: AsyncSession, user_id: int) -> User | None:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()
