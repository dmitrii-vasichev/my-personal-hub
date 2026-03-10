from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class SearchRequest(BaseModel):
    query: str
    location: Optional[str] = None
    provider: str = "adzuna"
    page: int = 1
    limit: int = Field(default=10, ge=1, le=100)


class SearchResultSchema(BaseModel):
    title: str
    company: str
    location: Optional[str] = None
    url: Optional[str] = None
    description: Optional[str] = None
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    salary_currency: str = "USD"
    source: str
    found_at: Optional[datetime] = None


class SaveSearchResultRequest(BaseModel):
    title: str
    company: str
    location: Optional[str] = None
    url: Optional[str] = None
    description: Optional[str] = None
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    salary_currency: str = "USD"
    source: str
    found_at: Optional[datetime] = None


class AutoSearchRequest(BaseModel):
    page: int = 1
    limit: int = Field(default=30, ge=1, le=100)
