from datetime import date, datetime, time

from typing import Optional

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Time, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Birthday(Base):
    __tablename__ = "birthdays"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    birth_date: Mapped[date] = mapped_column(Date, nullable=False)
    birth_year: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    advance_days: Mapped[int] = mapped_column(
        Integer, nullable=False, default=3, server_default="3"
    )
    reminder_time: Mapped[time] = mapped_column(
        Time, nullable=False, default=time(10, 0), server_default="10:00:00"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
