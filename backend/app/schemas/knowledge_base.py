from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class KBDocumentCreate(BaseModel):
    slug: str
    title: str
    content: str
    used_by: list[str] = []


class KBDocumentUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    used_by: Optional[list[str]] = None


class KBDocumentResponse(BaseModel):
    id: int
    user_id: int
    slug: str
    title: str
    content: str
    is_default: bool
    used_by: list[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
