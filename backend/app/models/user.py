import enum
from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, DateTime, Enum, String, Boolean, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class UserRole(str, enum.Enum):
    admin = "admin"
    member = "member"
    demo = "demo"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.member, nullable=False)
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_blocked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    last_login_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    theme: Mapped[str] = mapped_column(String(10), default="dark", nullable=False)
    # IANA timezone name. Source of truth for per-user tz (consolidated from
    # pulse_settings in Phase 1). All callers should read User.timezone.
    timezone: Mapped[str] = mapped_column(
        String(64), nullable=False, server_default="UTC"
    )
    # Reserved for Phase 3 (Telegram bot PIN authentication). Not exposed in
    # public schemas; populated by the bot pairing flow.
    telegram_pin_hash: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True
    )
    telegram_user_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, nullable=True, unique=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
