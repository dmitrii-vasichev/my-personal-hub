"""
Unified job search service with multi-provider support.
"""
from datetime import datetime
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.job import Job
from app.models.settings import UserSettings
from app.models.user import User
from app.services.providers.base import SearchResult
from app.services.providers import adzuna, serpapi, jsearch
from app.services.settings import get_or_create_settings, get_decrypted_key


async def search_jobs(
    db: AsyncSession,
    user: User,
    query: str,
    location: Optional[str],
    provider: str,
    page: int = 1,
    limit: int = 10,
) -> list[SearchResult]:
    """Search external job boards with the selected provider."""
    settings = await get_or_create_settings(db, user)

    if provider == "adzuna":
        app_id = get_decrypted_key(settings, "api_key_adzuna_id")
        app_key = get_decrypted_key(settings, "api_key_adzuna_key")
        if not app_id or not app_key:
            raise ValueError("Adzuna API credentials not configured. Set them in Settings.")
        return await adzuna.search(query, location, app_id, app_key, page, limit=limit)

    elif provider == "serpapi":
        api_key = get_decrypted_key(settings, "api_key_serpapi")
        if not api_key:
            raise ValueError("SerpAPI key not configured. Set it in Settings.")
        return await serpapi.search(query, location, api_key, page, limit=limit)

    elif provider == "jsearch":
        api_key = get_decrypted_key(settings, "api_key_jsearch")
        if not api_key:
            raise ValueError("JSearch API key not configured. Set it in Settings.")
        return await jsearch.search(query, location, api_key, page, limit=limit)

    else:
        raise ValueError(f"Unknown provider: {provider}")


async def save_search_result(
    db: AsyncSession,
    user: User,
    result: SearchResult,
) -> Job:
    """Persist a search result as a Job in the database."""
    job = Job(
        user_id=user.id,
        title=result.title,
        company=result.company,
        location=result.location,
        url=result.url,
        description=result.description,
        salary_min=result.salary_min,
        salary_max=result.salary_max,
        salary_currency=result.salary_currency or "USD",
        source=result.source,
        tags=[],
        found_at=result.found_at or datetime.utcnow(),
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    return job


async def auto_search(
    db: AsyncSession,
    user: User,
    page: int = 1,
    limit: int = 30,
) -> list[SearchResult]:
    """Run searches across all configured providers using saved target roles."""
    settings = await get_or_create_settings(db, user)

    target_roles = settings.target_roles or []
    location = settings.default_location

    if not target_roles:
        raise ValueError("No target roles configured. Set them in Settings.")

    query = " OR ".join(target_roles)
    results: list[SearchResult] = []

    providers = ("adzuna", "serpapi", "jsearch")
    per_provider = max(1, limit // len(providers))

    # Try each configured provider
    for provider in providers:
        try:
            provider_results = await search_jobs(
                db, user, query, location, provider, page, limit=per_provider
            )
            results.extend(provider_results)
        except ValueError:
            pass  # Provider not configured — skip silently

    # Deduplicate by URL
    seen_urls: set[str] = set()
    deduplicated = []
    for r in results:
        key = r.url or f"{r.title}|{r.company}"
        if key not in seen_urls:
            seen_urls.add(key)
            deduplicated.append(r)

    return deduplicated[:limit]
