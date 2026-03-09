import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.job import JobResponse
from app.schemas.search import (
    AutoSearchRequest,
    SaveSearchResultRequest,
    SearchRequest,
    SearchResultSchema,
)
from app.services import search as search_service
from app.services.providers.base import SearchResult

router = APIRouter(prefix="/api/search", tags=["search"])


@router.post("/", response_model=list[SearchResultSchema])
async def search_jobs(
    data: SearchRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Search external job boards with the selected provider."""
    try:
        results = await search_service.search_jobs(
            db, current_user, data.query, data.location, data.provider, data.page
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except httpx.TimeoutException:
        raise HTTPException(status_code=status.HTTP_408_REQUEST_TIMEOUT, detail="Search provider timed out")
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Search provider returned {exc.response.status_code}",
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Search failed — check your API key and try again",
        )
    return [
        SearchResultSchema(
            title=r.title,
            company=r.company,
            location=r.location,
            url=r.url,
            description=r.description,
            salary_min=r.salary_min,
            salary_max=r.salary_max,
            salary_currency=r.salary_currency,
            source=r.source,
            found_at=r.found_at,
        )
        for r in results
    ]


@router.post("/save", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
async def save_result(
    data: SaveSearchResultRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Save a search result as a tracked Job."""
    result = SearchResult(
        title=data.title,
        company=data.company,
        location=data.location,
        url=data.url,
        description=data.description,
        salary_min=data.salary_min,
        salary_max=data.salary_max,
        salary_currency=data.salary_currency or "USD",
        source=data.source,
        found_at=data.found_at,
    )
    job = await search_service.save_search_result(db, current_user, result)
    # Return without application (freshly created)
    return {
        **{c.name: getattr(job, c.name) for c in job.__table__.columns},
        "application": None,
    }


@router.post("/auto", response_model=list[SearchResultSchema])
async def auto_search(
    data: AutoSearchRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Run auto-search using saved target roles and default location."""
    try:
        results = await search_service.auto_search(db, current_user, data.page)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Auto-search failed",
        )
    return [
        SearchResultSchema(
            title=r.title,
            company=r.company,
            location=r.location,
            url=r.url,
            description=r.description,
            salary_min=r.salary_min,
            salary_max=r.salary_max,
            salary_currency=r.salary_currency,
            source=r.source,
            found_at=r.found_at,
        )
        for r in results
    ]
