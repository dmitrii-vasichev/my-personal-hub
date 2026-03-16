from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel


class InboxAction(str, Enum):
    to_task = "to_task"
    to_note = "to_note"
    skip = "skip"


class InboxItemResponse(BaseModel):
    id: int
    text: Optional[str] = None
    sender_name: Optional[str] = None
    message_date: Optional[datetime] = None
    source_title: Optional[str] = None
    source_id: int
    ai_classification: Optional[str] = None
    ai_relevance: Optional[float] = None
    status: str
    collected_at: datetime

    model_config = {"from_attributes": True}


class InboxListResponse(BaseModel):
    items: list[InboxItemResponse]
    total: int


class InboxActionRequest(BaseModel):
    action: InboxAction


class BulkActionRequest(BaseModel):
    message_ids: list[int]
    action: InboxAction
