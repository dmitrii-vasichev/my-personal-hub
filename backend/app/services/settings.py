from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.encryption import encrypt_value, decrypt_value
from app.models.settings import UserSettings
from app.models.user import User
from app.schemas.settings import SettingsUpdate, SettingsResponse


async def get_or_create_settings(db: AsyncSession, user: User) -> UserSettings:
    """Return the user's settings row, creating defaults if it doesn't exist yet."""
    result = await db.execute(
        select(UserSettings).where(UserSettings.user_id == user.id)
    )
    settings = result.scalar_one_or_none()
    if settings is None:
        settings = UserSettings(user_id=user.id)
        db.add(settings)
        await db.commit()
        await db.refresh(settings)
    return settings


async def update_settings(
    db: AsyncSession, user: User, data: SettingsUpdate
) -> UserSettings:
    """Upsert user settings. Encrypts API keys before storing."""
    settings = await get_or_create_settings(db, user)

    if data.default_location is not None:
        settings.default_location = data.default_location
    if data.target_roles is not None:
        settings.target_roles = data.target_roles
    if data.min_match_score is not None:
        settings.min_match_score = data.min_match_score
    if data.excluded_companies is not None:
        settings.excluded_companies = data.excluded_companies
    if data.stale_threshold_days is not None:
        settings.stale_threshold_days = data.stale_threshold_days
    if data.llm_provider is not None:
        settings.llm_provider = data.llm_provider

    # Encrypt API keys before storing — empty string clears the key
    _ENCRYPTED_FIELDS = [
        ("api_key_openai", "api_key_openai"),
        ("api_key_anthropic", "api_key_anthropic"),
        ("api_key_gemini", "api_key_gemini"),
        ("api_key_adzuna_id", "api_key_adzuna_id"),
        ("api_key_adzuna_key", "api_key_adzuna_key"),
        ("api_key_serpapi", "api_key_serpapi"),
        ("api_key_jsearch", "api_key_jsearch"),
    ]
    for input_field, model_field in _ENCRYPTED_FIELDS:
        value = getattr(data, input_field, None)
        if value is not None:
            setattr(settings, model_field, encrypt_value(value) if value else None)

    await db.commit()
    await db.refresh(settings)
    return settings


def to_response(settings: UserSettings) -> SettingsResponse:
    """Convert ORM model to response schema, masking API keys."""
    return SettingsResponse(
        id=settings.id,
        user_id=settings.user_id,
        default_location=settings.default_location,
        target_roles=settings.target_roles or [],
        min_match_score=settings.min_match_score,
        excluded_companies=settings.excluded_companies or [],
        stale_threshold_days=settings.stale_threshold_days,
        llm_provider=settings.llm_provider,
        has_api_key_openai=bool(settings.api_key_openai),
        has_api_key_anthropic=bool(settings.api_key_anthropic),
        has_api_key_gemini=bool(settings.api_key_gemini),
        has_api_key_adzuna=bool(settings.api_key_adzuna_id and settings.api_key_adzuna_key),
        has_api_key_serpapi=bool(settings.api_key_serpapi),
        has_api_key_jsearch=bool(settings.api_key_jsearch),
        updated_at=settings.updated_at,
    )


def get_decrypted_key(settings: UserSettings, field: str) -> Optional[str]:
    """Decrypt and return a single API key for internal use only (never expose via API)."""
    encrypted = getattr(settings, field, None)
    if not encrypted:
        return None
    try:
        return decrypt_value(encrypted)
    except ValueError:
        return None
