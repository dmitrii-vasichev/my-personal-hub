from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class TagCreate(BaseModel):
    name: str = Field(..., max_length=50)
    color: str = Field(default="#4f8ef7", max_length=7)


class TagUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=50)
    color: Optional[str] = Field(default=None, max_length=7)


class TagBrief(BaseModel):
    id: int
    name: str
    color: str

    model_config = {"from_attributes": True}


class TagResponse(TagBrief):
    task_count: int = 0
    created_at: datetime


class BulkTagRequest(BaseModel):
    task_ids: list[int] = Field(..., max_length=50)
    add_tag_ids: list[int] = []
    remove_tag_ids: list[int] = []


class BulkTagResponse(BaseModel):
    affected_tasks: int
