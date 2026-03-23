"""Shared types for job search provider adapters."""
from dataclasses import dataclass
from datetime import datetime
from typing import Optional


@dataclass
class SearchResult:
    title: str
    company: str
    source: str
    location: Optional[str] = None
    url: Optional[str] = None
    description: Optional[str] = None
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    salary_currency: str = "USD"
    found_at: Optional[datetime] = None
