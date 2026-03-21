from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel


class DigestResponse(BaseModel):
    id: int
    user_id: int
    category: Optional[str] = None
    content: Optional[str] = None
    digest_type: str = "markdown"
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


class DigestItemResponse(BaseModel):
    id: int
    digest_id: int
    title: str
    summary: str
    classification: str
    metadata: Optional[dict] = None
    source_names: Optional[list[str]] = None
    status: str = "new"
    action_type: Optional[str] = None
    action_result_id: Optional[int] = None
    created_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_item(cls, item) -> "DigestItemResponse":
        return cls(
            id=item.id,
            digest_id=item.digest_id,
            title=item.title,
            summary=item.summary,
            classification=item.classification,
            metadata=item.metadata_,
            source_names=item.source_names,
            status=item.status,
            action_type=item.action_type,
            action_result_id=item.action_result_id,
            created_at=item.created_at,
        )


class DigestItemListResponse(BaseModel):
    items: list[DigestItemResponse]
    total: int
    is_markdown: bool = False


class DigestItemAction(BaseModel):
    action: Literal["to_task", "to_note", "to_job", "skip"]


class DigestItemBulkAction(BaseModel):
    item_ids: list[int]
    action: Literal["to_task", "to_note", "to_job", "skip"]


class PreviewItem(BaseModel):
    """Single headline item for dashboard widget preview."""

    title: str
    classification: Optional[str] = None


class DigestSummaryItem(BaseModel):
    """Compact digest info for dashboard widget."""

    id: int
    category: Optional[str] = None
    content_preview: str
    message_count: int
    items_count: Optional[int] = None
    generated_at: datetime
    preview_items: list[PreviewItem] = []

    model_config = {"from_attributes": True}


class PulseSummaryResponse(BaseModel):
    """Aggregated pulse data for dashboard widget."""

    digests: list[DigestSummaryItem]
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None
