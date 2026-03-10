"""JSearch (RapidAPI) provider adapter."""
from datetime import datetime
from typing import Optional

import httpx

from app.services.providers.base import SearchResult

JSEARCH_BASE = "https://jsearch.p.rapidapi.com/search"


async def search(
    query: str,
    location: Optional[str],
    api_key: str,
    page: int = 1,
    limit: int = 10,
) -> list[SearchResult]:
    q = f"{query} in {location}" if location else query
    params = {
        "query": q,
        "page": str(page),
        "num_pages": str(max(1, (limit + 9) // 10)),
    }
    headers = {
        "X-RapidAPI-Key": api_key,
        "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(JSEARCH_BASE, params=params, headers=headers)
        response.raise_for_status()
        data = response.json()

    results = []
    for item in data.get("data", []):
        salary_min = salary_max = None
        if item.get("job_min_salary"):
            salary_min = int(item["job_min_salary"])
        if item.get("job_max_salary"):
            salary_max = int(item["job_max_salary"])
        currency = item.get("job_salary_currency") or "USD"

        posted_at = None
        if item.get("job_posted_at_datetime_utc"):
            try:
                posted_at = datetime.fromisoformat(
                    item["job_posted_at_datetime_utc"].replace("Z", "+00:00")
                )
            except ValueError:
                pass

        results.append(
            SearchResult(
                title=item.get("job_title", ""),
                company=item.get("employer_name", ""),
                location=item.get("job_city") or item.get("job_country"),
                url=item.get("job_apply_link") or item.get("job_google_link"),
                description=item.get("job_description"),
                salary_min=salary_min,
                salary_max=salary_max,
                salary_currency=currency,
                source="jsearch",
                found_at=posted_at,
            )
        )

    return results[:limit]
