from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True
    )

    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    skills: Mapped[list] = mapped_column(JSON, default=list, nullable=False, server_default="[]")
    experience: Mapped[list] = mapped_column(JSON, default=list, nullable=False, server_default="[]")
    education: Mapped[list] = mapped_column(JSON, default=list, nullable=False, server_default="[]")
    contacts: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False, server_default="{}")
    raw_import: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
