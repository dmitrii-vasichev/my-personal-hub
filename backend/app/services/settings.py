from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.encryption import encrypt_value, decrypt_value
from app.models.settings import UserSettings
from app.models.user import User
from app.schemas.settings import MemberSettingsResponse, SettingsUpdate, SettingsResponse


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
    """Upsert user settings. Encrypts API keys before storing.
    Members can only update job search fields; AI provider and API keys are ignored.
    """
    from app.models.user import UserRole

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

    # Only admins can change AI provider and API keys
    if user.role == UserRole.admin:
        if data.llm_provider is not None:
            settings.llm_provider = data.llm_provider

        _ENCRYPTED_FIELDS = [
            ("api_key_openai", "api_key_openai"),
            ("api_key_anthropic", "api_key_anthropic"),
            ("api_key_gemini", "api_key_gemini"),
            ("api_key_adzuna_id", "api_key_adzuna_id"),
            ("api_key_adzuna_key", "api_key_adzuna_key"),
            ("api_key_serpapi", "api_key_serpapi"),
            ("api_key_jsearch", "api_key_jsearch"),
            ("google_client_id", "google_client_id"),
            ("google_client_secret", "google_client_secret"),
        ]
        for input_field, model_field in _ENCRYPTED_FIELDS:
            value = getattr(data, input_field, None)
            if value is not None:
                setattr(settings, model_field, encrypt_value(value) if value else None)

        # google_redirect_uri is not a secret — store as plain text
        if data.google_redirect_uri is not None:
            settings.google_redirect_uri = data.google_redirect_uri or None

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
        has_google_client_id=bool(settings.google_client_id),
        has_google_client_secret=bool(settings.google_client_secret),
        google_redirect_uri=settings.google_redirect_uri,
        updated_at=settings.updated_at,
    )


def to_member_response(settings: UserSettings) -> MemberSettingsResponse:
    """Convert ORM model to member-safe response (job search fields only)."""
    return MemberSettingsResponse(
        id=settings.id,
        user_id=settings.user_id,
        default_location=settings.default_location,
        target_roles=settings.target_roles or [],
        min_match_score=settings.min_match_score,
        excluded_companies=settings.excluded_companies or [],
        stale_threshold_days=settings.stale_threshold_days,
        updated_at=settings.updated_at,
    )


async def get_google_oauth_credentials(
    db: AsyncSession,
) -> Optional[tuple[str, str, str]]:
    """Return (client_id, client_secret, redirect_uri) from admin's settings.

    Looks up the first admin user's settings that have google_client_id set.
    Returns None if no admin has configured Google OAuth credentials.
    """
    from app.models.user import User, UserRole

    result = await db.execute(
        select(UserSettings)
        .join(User, UserSettings.user_id == User.id)
        .where(User.role == UserRole.admin, UserSettings.google_client_id.isnot(None))
        .limit(1)
    )
    admin_settings = result.scalar_one_or_none()
    if not admin_settings or not admin_settings.google_client_id:
        return None

    client_id = get_decrypted_key(admin_settings, "google_client_id")
    client_secret = get_decrypted_key(admin_settings, "google_client_secret")
    if not client_id or not client_secret:
        return None

    redirect_uri = admin_settings.google_redirect_uri or ""
    return (client_id, client_secret, redirect_uri)


def get_decrypted_key(settings: UserSettings, field: str) -> Optional[str]:
    """Decrypt and return a single API key for internal use only (never expose via API)."""
    encrypted = getattr(settings, field, None)
    if not encrypted:
        return None
    try:
        return decrypt_value(encrypted)
    except ValueError:
        return None
