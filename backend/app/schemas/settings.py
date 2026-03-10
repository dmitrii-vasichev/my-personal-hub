from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class SettingsUpdate(BaseModel):
    default_location: Optional[str] = None
    target_roles: Optional[list[str]] = None
    min_match_score: Optional[int] = None
    excluded_companies: Optional[list[str]] = None
    stale_threshold_days: Optional[int] = None
    llm_provider: Optional[str] = None
    # Plain API keys — encrypted before storage, never returned in plaintext
    api_key_openai: Optional[str] = None
    api_key_anthropic: Optional[str] = None
    api_key_gemini: Optional[str] = None
    api_key_adzuna_id: Optional[str] = None
    api_key_adzuna_key: Optional[str] = None
    api_key_serpapi: Optional[str] = None
    api_key_jsearch: Optional[str] = None
    # Google Calendar OAuth2 credentials (admin-only, encrypted before storage)
    google_client_id: Optional[str] = None
    google_client_secret: Optional[str] = None
    google_redirect_uri: Optional[str] = None


class SettingsResponse(BaseModel):
    id: int
    user_id: int
    default_location: Optional[str]
    target_roles: list[str]
    min_match_score: int
    excluded_companies: list[str]
    stale_threshold_days: int
    llm_provider: str
    # Masked: True if key is set, False if not — never expose actual key
    has_api_key_openai: bool
    has_api_key_anthropic: bool
    has_api_key_gemini: bool
    has_api_key_adzuna: bool
    has_api_key_serpapi: bool
    has_api_key_jsearch: bool
    # Google Calendar OAuth2
    has_google_client_id: bool
    has_google_client_secret: bool
    google_redirect_uri: Optional[str]
    updated_at: datetime

    model_config = {"from_attributes": True}


class MemberSettingsResponse(BaseModel):
    """Settings view for members — job search fields only, no API key visibility."""

    id: int
    user_id: int
    default_location: Optional[str]
    target_roles: list[str]
    min_match_score: int
    excluded_companies: list[str]
    stale_threshold_days: int
    updated_at: datetime
