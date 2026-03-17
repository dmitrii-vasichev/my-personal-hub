from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class DigestResponse(BaseModel):
    id: int
    user_id: int
    category: Optional[str] = None
    content: str
    message_count: int
    items_count: Optional[int] = None
    generated_at: datetime
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None

    model_config = {"from_attributes": True}


class DigestListResponse(BaseModel):
    items: list[DigestResponse]
    total: int


class DigestGenerateRequest(BaseModel):
    category: Optional[str] = None


class DigestGenerateResponse(BaseModel):
    digest: Optional[DigestResponse] = None
    message: str


class DigestSummaryItem(BaseModel):
    """Compact digest info for dashboard widget."""

    id: int
    category: Optional[str] = None
    content_preview: str
    message_count: int
    items_count: Optional[int] = None
    generated_at: datetime

    model_config = {"from_attributes": True}


class PulseSummaryResponse(BaseModel):
    """Aggregated pulse data for dashboard widget."""

    digests: list[DigestSummaryItem]
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None
