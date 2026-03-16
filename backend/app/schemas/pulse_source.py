from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class PulseSourceCreate(BaseModel):
    telegram_id: int
    username: Optional[str] = None
    title: str
    category: str
    subcategory: Optional[str] = None
    keywords: Optional[list[str]] = None
    criteria: Optional[dict] = None


class PulseSourceUpdate(BaseModel):
    title: Optional[str] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    keywords: Optional[list[str]] = None
    criteria: Optional[dict] = None
    is_active: Optional[bool] = None


class PulseSourceResponse(BaseModel):
    id: int
    user_id: int
    telegram_id: int
    username: Optional[str] = None
    title: str
    category: str
    subcategory: Optional[str] = None
    keywords: Optional[list[str]] = None
    criteria: Optional[dict] = None
    is_active: bool
    last_polled_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class PulseSourceResolveResponse(BaseModel):
    telegram_id: int
    username: Optional[str] = None
    title: str
    members_count: Optional[int] = None
