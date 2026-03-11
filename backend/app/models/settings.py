from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class UserSettings(Base):
    __tablename__ = "user_settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True
    )

    default_location: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    target_roles: Mapped[list] = mapped_column(
        JSON, default=list, nullable=False, server_default="[]"
    )
    min_match_score: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    excluded_companies: Mapped[list] = mapped_column(
        JSON, default=list, nullable=False, server_default="[]"
    )
    stale_threshold_days: Mapped[int] = mapped_column(Integer, nullable=False, server_default="14")

    # LLM provider: openai, anthropic, gemini
    llm_provider: Mapped[str] = mapped_column(
        String(50), nullable=False, server_default="openai"
    )

    # Encrypted API keys (stored as Fernet-encrypted base64 strings)
    api_key_openai: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    api_key_anthropic: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    api_key_gemini: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Adzuna uses two keys
    api_key_adzuna_id: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    api_key_adzuna_key: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    api_key_serpapi: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    api_key_jsearch: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Google Calendar OAuth2 credentials (encrypted, admin-only)
    google_client_id: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    google_client_secret: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    google_redirect_uri: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Google Drive notes folder ID (plain text, not a secret)
    google_drive_notes_folder_id: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True
    )

    # AI prompt instructions (custom per-user overrides for each operation)
    instruction_resume: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    instruction_ats_audit: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    instruction_gap_analysis: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    instruction_cover_letter: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
