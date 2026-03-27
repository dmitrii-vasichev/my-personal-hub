from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.models.outreach import LeadStatus


# ── Nested schemas ───────────────────────────────────────────────────────────


class LeadStatusHistoryResponse(BaseModel):
    id: int
    lead_id: int
    old_status: Optional[str]
    new_status: str
    comment: Optional[str]
    changed_at: datetime

    model_config = {"from_attributes": True}


class IndustryResponse(BaseModel):
    id: int
    user_id: int
    name: str
    slug: str
    drive_file_id: Optional[str]
    description: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Lead schemas ─────────────────────────────────────────────────────────────


class LeadCreate(BaseModel):
    business_name: str
    industry_id: Optional[int] = None
    contact_person: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    service_description: Optional[str] = None
    source: str = "manual"
    source_detail: Optional[str] = None
    notes: Optional[str] = None


class LeadUpdate(BaseModel):
    business_name: Optional[str] = None
    industry_id: Optional[int] = None
    contact_person: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    service_description: Optional[str] = None
    source: Optional[str] = None
    source_detail: Optional[str] = None
    notes: Optional[str] = None
    proposal_text: Optional[str] = None


class LeadStatusChange(BaseModel):
    new_status: LeadStatus
    comment: Optional[str] = None


class LeadResponse(BaseModel):
    id: int
    user_id: int
    business_name: str
    industry_id: Optional[int]
    contact_person: Optional[str]
    email: Optional[str]
    phone: Optional[str]
    website: Optional[str]
    service_description: Optional[str]
    source: str
    source_detail: Optional[str]
    status: str
    notes: Optional[str]
    proposal_text: Optional[str]
    status_history: list[LeadStatusHistoryResponse] = []
    industry: Optional[IndustryResponse] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Kanban schemas ───────────────────────────────────────────────────────────


class LeadKanbanCard(BaseModel):
    id: int
    business_name: str
    contact_person: Optional[str] = None
    industry_id: Optional[int] = None
    status: str
    email: Optional[str] = None
    phone: Optional[str] = None
    updated_at: datetime

    model_config = {"from_attributes": True}


class LeadKanbanResponse(BaseModel):
    new: list[LeadKanbanCard] = []
    sent: list[LeadKanbanCard] = []
    replied: list[LeadKanbanCard] = []
    in_progress: list[LeadKanbanCard] = []
    rejected: list[LeadKanbanCard] = []
    on_hold: list[LeadKanbanCard] = []


# ── Industry schemas ─────────────────────────────────────────────────────────


# ── PDF parsing schemas ─────────────────────────────────────────────────────


class ParsedLead(BaseModel):
    """Single lead extracted from a PDF page by Vision API."""
    business_name: str
    contact_person: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    service_description: Optional[str] = None
    industry_suggestion: Optional[str] = None
    page: int = 0


class PdfParseError(BaseModel):
    page: int
    error: str


class PdfParseResponse(BaseModel):
    total_pages: int
    leads: list[ParsedLead]
    errors: list[PdfParseError] = []


class BatchLeadCreate(BaseModel):
    """Batch-save multiple leads at once (after PDF preview confirmation)."""
    leads: list[LeadCreate]


# ── Industry schemas ─────────────────────────────────────────────────────────


class ProposalGenerateRequest(BaseModel):
    """Optional custom instructions for proposal generation."""
    custom_instructions: Optional[str] = None


class IndustryCreate(BaseModel):
    name: str
    slug: str
    drive_file_id: Optional[str] = None
    description: Optional[str] = None


class IndustryUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    drive_file_id: Optional[str] = None
    description: Optional[str] = None
