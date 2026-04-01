from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.models.outreach import ActivityType, LeadStatus


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
    prompt_instructions: Optional[str]
    description: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Activity schemas ────────────────────────────────────────────────────────


class ActivityCreate(BaseModel):
    activity_type: ActivityType
    subject: Optional[str] = None
    body: Optional[str] = None


class SendEmailRequest(BaseModel):
    subject: str
    body: str


class ActivityResponse(BaseModel):
    id: int
    lead_id: int
    activity_type: str
    subject: Optional[str]
    body: Optional[str]
    gmail_message_id: Optional[str]
    gmail_thread_id: Optional[str]
    created_at: datetime

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
    contacted: list[LeadKanbanCard] = []
    follow_up: list[LeadKanbanCard] = []
    responded: list[LeadKanbanCard] = []
    negotiating: list[LeadKanbanCard] = []
    won: list[LeadKanbanCard] = []
    lost: list[LeadKanbanCard] = []
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
    language: str = "Russian"


class IndustryInstructionGenerateRequest(BaseModel):
    """Language preference for generating industry instructions."""
    language: str = "English"


# ── Duplicate detection schemas ─────────────────────────────────────────────


class CheckDuplicatesRequest(BaseModel):
    """Check for duplicate leads by email/phone."""
    emails: list[str] = []
    phones: list[str] = []
    exclude_id: Optional[int] = None


class DuplicateMatch(BaseModel):
    field: str  # "email" or "phone"
    value: str
    existing_lead_id: int
    existing_business_name: str


class CheckDuplicatesResponse(BaseModel):
    duplicates: list[DuplicateMatch] = []


# ── Analytics schemas ───────────────────────────────────────────────────────


class StatusCount(BaseModel):
    status: str
    count: int


class IndustryBreakdown(BaseModel):
    industry_name: str
    count: int


class OutreachAnalytics(BaseModel):
    total: int
    by_status: list[StatusCount]
    by_industry: list[IndustryBreakdown]
    conversion_contacted_to_responded: float | None = None
    conversion_responded_to_negotiating: float | None = None


class IndustryCreate(BaseModel):
    name: str
    slug: str
    prompt_instructions: Optional[str] = None
    description: Optional[str] = None


class IndustryUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    prompt_instructions: Optional[str] = None
    description: Optional[str] = None


class IndustryCasesImport(BaseModel):
    markdown_content: str


class IndustryCasesImportResponse(BaseModel):
    matched_count: int
    updated_count: int


# ── Batch outreach schemas ─────────────────────────────────────────────────


class BatchPrepareRequest(BaseModel):
    """Filter leads for batch outreach and generate missing proposals."""
    status: Optional[list[str]] = None
    industry_id: Optional[int] = None
    subject_template: str = "Коммерческое предложение — {business_name}"


class BatchItemPreview(BaseModel):
    lead_id: int
    business_name: str
    email: Optional[str]
    industry_name: Optional[str]
    subject: str
    body: str
    included: bool = True

    model_config = {"from_attributes": True}


class BatchPrepareResponse(BaseModel):
    job_id: int
    items: list[BatchItemPreview]
    total: int
    skipped_no_email: int
    skipped_no_proposal: int


class BatchItemUpdate(BaseModel):
    lead_id: int
    subject: Optional[str] = None
    body: Optional[str] = None
    included: bool = True


class BatchSendRequest(BaseModel):
    job_id: int
    items: list[BatchItemUpdate]


class BatchItemResponse(BaseModel):
    id: int
    lead_id: int
    subject: str
    body: str
    status: str
    error_message: Optional[str]
    sent_at: Optional[datetime]
    lead_business_name: Optional[str] = None

    model_config = {"from_attributes": True}


class BatchJobResponse(BaseModel):
    id: int
    status: str
    total_count: int
    sent_count: int
    failed_count: int
    items: list[BatchItemResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
