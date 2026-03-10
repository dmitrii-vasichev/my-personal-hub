"""SerpAPI Google Jobs provider adapter."""
from datetime import datetime
from typing import Optional

import httpx

from app.services.providers.base import SearchResult

SERPAPI_BASE = "https://serpapi.com/search"


async def search(
    query: str,
    location: Optional[str],
    api_key: str,
    page: int = 1,
    limit: int = 10,
) -> list[SearchResult]:
    params = {
        "engine": "google_jobs",
        "q": query,
        "api_key": api_key,
        "start": (page - 1) * limit,
    }
    if location:
        params["location"] = location

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(SERPAPI_BASE, params=params)
        response.raise_for_status()
        data = response.json()

    results = []
    for item in data.get("jobs_results", []):
        salary_min = salary_max = None
        salary_currency = "USD"
        detected = item.get("detected_extensions", {})
        if "salary" in detected:
            salary_str = detected["salary"]
            # Extract numbers if present — best-effort parsing
            import re
            nums = re.findall(r"[\d,]+", salary_str.replace(",", ""))
            if nums:
                salary_min = int(nums[0])
                salary_max = int(nums[-1]) if len(nums) > 1 else None

        results.append(
            SearchResult(
                title=item.get("title", ""),
                company=item.get("company_name", ""),
                location=item.get("location"),
                url=item.get("related_links", [{}])[0].get("link") if item.get("related_links") else None,
                description=item.get("description"),
                salary_min=salary_min,
                salary_max=salary_max,
                salary_currency=salary_currency,
                source="serpapi",
                found_at=datetime.utcnow(),
            )
        )

    return results[:limit]
