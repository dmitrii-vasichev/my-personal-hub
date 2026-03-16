from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class NoteResponse(BaseModel):
    id: int
    user_id: int
    google_file_id: str
    title: str
    folder_path: Optional[str] = None
    mime_type: Optional[str] = None
    last_synced_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class LinkedNoteBrief(BaseModel):
    id: int
    title: str
    folder_path: Optional[str] = None
    google_file_id: str

    model_config = {"from_attributes": True}


class LinkedJobBrief(BaseModel):
    id: int
    title: str
    company: Optional[str] = None
    status: str

    model_config = {"from_attributes": True}


class NoteCreate(BaseModel):
    title: str
    content: str


class NoteTreeNode(BaseModel):
    id: Optional[str] = None
    name: str
    type: str  # "folder" or "file"
    google_file_id: str
    children: list[NoteTreeNode] = []


class NoteTreeResponse(BaseModel):
    folder_id: str
    tree: list[NoteTreeNode]
