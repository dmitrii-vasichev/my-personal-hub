"""Seed the first admin user. Run with: python -m app.scripts.seed_admin"""

import asyncio

from sqlalchemy import select

from app.core.config import settings
from app.core.database import async_session_factory
from app.core.security import hash_password
from app.models.user import User, UserRole


async def seed():
    async with async_session_factory() as session:
        result = await session.execute(select(User).where(User.role == UserRole.admin))
        existing = result.scalar_one_or_none()
        if existing:
            print(f"Admin already exists: {existing.email}")
            return

        admin = User(
            email=settings.ADMIN_EMAIL,
            password_hash=hash_password(settings.ADMIN_PASSWORD),
            display_name="Admin",
            role=UserRole.admin,
            must_change_password=False,
        )
        session.add(admin)
        await session.commit()
        print(f"Admin created: {settings.ADMIN_EMAIL}")


if __name__ == "__main__":
    asyncio.run(seed())
