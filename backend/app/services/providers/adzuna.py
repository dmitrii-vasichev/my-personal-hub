"""Adzuna job search provider adapter."""
from datetime import datetime
from typing import Optional

import httpx

from app.services.providers.base import SearchResult

ADZUNA_BASE = "https://api.adzuna.com/v1/api/jobs"
DEFAULT_COUNTRY = "gb"


async def search(
    query: str,
    location: Optional[str],
    app_id: str,
    app_key: str,
    page: int = 1,
    country: str = DEFAULT_COUNTRY,
) -> list[SearchResult]:
    params = {
        "app_id": app_id,
        "app_key": app_key,
        "results_per_page": 10,
        "what": query,
        "content-type": "application/json",
        "page": page,
    }
    if location:
        params["where"] = location

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(f"{ADZUNA_BASE}/{country}/search/{page}", params=params)
        response.raise_for_status()
        data = response.json()

    results = []
    for item in data.get("results", []):
        salary_min = salary_max = None
        if "salary_min" in item:
            salary_min = int(item["salary_min"])
        if "salary_max" in item:
            salary_max = int(item["salary_max"])

        created = None
        if "created" in item:
            try:
                created = datetime.fromisoformat(item["created"].replace("Z", "+00:00"))
            except ValueError:
                pass

        results.append(
            SearchResult(
                title=item.get("title", ""),
                company=item.get("company", {}).get("display_name", ""),
                location=item.get("location", {}).get("display_name"),
                url=item.get("redirect_url"),
                description=item.get("description"),
                salary_min=salary_min,
                salary_max=salary_max,
                salary_currency="GBP" if country == "gb" else "USD",
                source="adzuna",
                found_at=created,
            )
        )

    return results
