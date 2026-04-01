import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, status
from fastapi.responses import PlainTextResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import restrict_demo
from app.core.encryption import decrypt_value
from app.models.settings import UserSettings
from app.models.user import User
from app.schemas.outreach import (
    ActivityCreate,
    ActivityResponse,
    BatchLeadCreate,
    CheckDuplicatesRequest,
    CheckDuplicatesResponse,
    IndustryCasesImport,
    IndustryCasesImportResponse,
    IndustryCreate,
    IndustryInstructionGenerateRequest,
    IndustryResponse,
    IndustryUpdate,
    LeadCreate,
    LeadKanbanCard,
    LeadKanbanResponse,
    LeadResponse,
    LeadStatusChange,
    LeadStatusHistoryResponse,
    LeadUpdate,
    OutreachAnalytics,
    PdfParseResponse,
    ProposalGenerateRequest,
)
from app.schemas.outreach import (
    BatchJobResponse,
    BatchPrepareRequest,
    BatchPrepareResponse,
    BatchSendRequest,
)
from app.services import outreach as outreach_service
from app.services.batch_outreach import (
    cancel_batch,
    get_batch_job,
    pause_batch,
    prepare_batch,
    start_batch_send,
)
from app.services.lead_pdf_parser import parse_pdf
from app.services.lead_proposal import generate_proposal
from app.services.generate_industry_instructions import generate_industry_instructions_for_industry

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/leads", tags=["outreach"])


# ── Lead CRUD ────────────────────────────────────────────────────────────────


@router.post("/", response_model=LeadResponse, status_code=status.HTTP_201_CREATED)
async def create_lead(
    data: LeadCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(restrict_demo),
):
    lead = await outreach_service.create_lead(db, data, current_user)
    return lead


@router.post("/parse-pdf", response_model=PdfParseResponse)
async def parse_pdf_endpoint(
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(restrict_demo),
):
    """Upload a PDF and extract business contacts via GPT-4o Vision."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are accepted",
        )

    # Get OpenAI API key from user settings
    result = await db.execute(
        select(UserSettings).where(UserSettings.user_id == current_user.id)
    )
    settings = result.scalar_one_or_none()
    if not settings or not settings.api_key_openai:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OpenAI API key is not configured in settings",
        )

    try:
        api_key = decrypt_value(settings.api_key_openai)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to decrypt OpenAI API key",
        )

    pdf_bytes = await file.read()
    if len(pdf_bytes) > 50 * 1024 * 1024:  # 50 MB limit
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="PDF file is too large (max 50 MB)",
        )

    try:
        industries = await outreach_service.list_industries(db, current_user)
        existing_industries = [ind.name for ind in industries]
        
        result_data = await parse_pdf(
            pdf_bytes, 
            api_key, 
            filename=file.filename,
            existing_industries=existing_industries
        )
    except Exception as e:
        logger.error("PDF parsing failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"PDF parsing failed: {e}",
        )

    return result_data


@router.get("/analytics", response_model=OutreachAnalytics)
async def get_analytics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(restrict_demo),
):
    """Outreach funnel analytics: status counts, industry breakdown, conversion rates."""
    return await outreach_service.get_analytics(db, current_user)


@router.post("/check-duplicates", response_model=CheckDuplicatesResponse)
async def check_duplicates(
    data: CheckDuplicatesRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(restrict_demo),
):
    """Check if leads with given emails/phones already exist."""
    matches = await outreach_service.check_duplicates(
        db, current_user, data.emails, data.phones, exclude_id=data.exclude_id
    )
    return CheckDuplicatesResponse(duplicates=matches)


@router.post("/batch", response_model=list[LeadResponse], status_code=status.HTTP_201_CREATED)
async def batch_create_leads(
    data: BatchLeadCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(restrict_demo),
):
    """Save multiple leads at once (after PDF preview confirmation)."""
    if len(data.leads) > 200:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum 200 leads per batch",
        )
    leads = await outreach_service.batch_create_leads(db, data.leads, current_user)
    return leads


@router.get("/kanban", response_model=LeadKanbanResponse)
async def get_kanban(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(restrict_demo),
):
    buckets = await outreach_service.get_kanban(db, current_user)
    return {
        key: [LeadKanbanCard.model_validate(lead) for lead in leads]
        for key, leads in buckets.items()
    }


@router.get("/", response_model=list[LeadResponse])
async def list_leads(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(restrict_demo),
    search: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    industry_id: Optional[int] = Query(None),
    source: Optional[str] = Query(None),
    sort_by: str = Query("created_at"),
    sort_order: str = Query("desc"),
):
    leads = await outreach_service.list_leads(
        db,
        current_user,
        search=search,
        status=status_filter,
        industry_id=industry_id,
        source=source,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    return leads


@router.get("/{lead_id}", response_model=LeadResponse)
async def get_lead(
    lead_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(restrict_demo),
):
    lead = await outreach_service.get_lead(db, lead_id, current_user)
    if lead is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")
    return lead


@router.patch("/{lead_id}", response_model=LeadResponse)
async def update_lead(
    lead_id: int,
    data: LeadUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(restrict_demo),
):
    lead = await outreach_service.update_lead(db, lead_id, data, current_user)
    if lead is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")
    return lead


@router.delete("/{lead_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_lead(
    lead_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(restrict_demo),
):
    deleted = await outreach_service.delete_lead(db, lead_id, current_user)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")


@router.patch("/{lead_id}/status", response_model=LeadResponse)
async def change_lead_status(
    lead_id: int,
    data: LeadStatusChange,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(restrict_demo),
):
    lead = await outreach_service.change_lead_status(db, lead_id, data, current_user)
    if lead is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")
    return lead


@router.get("/{lead_id}/history", response_model=list[LeadStatusHistoryResponse])
async def get_lead_history(
    lead_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(restrict_demo),
):
    history = await outreach_service.get_lead_history(db, lead_id, current_user)
    if history is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")
    return history


# ── Activities ──────────────────────────────────────────────────────────────


@router.post(
    "/{lead_id}/activities",
    response_model=ActivityResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_activity(
    lead_id: int,
    data: ActivityCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(restrict_demo),
):
    activity = await outreach_service.create_activity(db, lead_id, data, current_user)
    if activity is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")
    return activity


@router.get("/{lead_id}/activities", response_model=list[ActivityResponse])
async def list_activities(
    lead_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(restrict_demo),
):
    activities = await outreach_service.list_activities(db, lead_id, current_user)
    if activities is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")
    return activities


@router.delete("/activities/{activity_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_activity(
    activity_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(restrict_demo),
):
    deleted = await outreach_service.delete_activity(db, activity_id, current_user)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activity not found")


# ── Proposal Generation ─────────────────────────────────────────────────────


@router.post("/{lead_id}/generate-proposal", response_model=LeadResponse)
async def generate_proposal_endpoint(
    lead_id: int,
    data: ProposalGenerateRequest = ProposalGenerateRequest(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(restrict_demo),
):
    """Generate a personalized commercial proposal for a lead using AI."""
    try:
        lead = await generate_proposal(
            db,
            current_user,
            lead_id,
            custom_instructions=data.custom_instructions,
            language=data.language,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.error("Proposal generation failed for lead %d: %s", lead_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Proposal generation failed: {e}",
        )

    if lead is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found"
        )
    return lead


# ── Industry CRUD ────────────────────────────────────────────────────────────

industry_router = APIRouter(prefix="/api/industries", tags=["outreach"])


@industry_router.post("/", response_model=IndustryResponse, status_code=status.HTTP_201_CREATED)
async def create_industry(
    data: IndustryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(restrict_demo),
):
    industry = await outreach_service.create_industry(db, data, current_user)
    return industry


@industry_router.get("/", response_model=list[IndustryResponse])
async def list_industries(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(restrict_demo),
):
    return await outreach_service.list_industries(db, current_user)


@industry_router.get("/cases/export")
async def export_industry_cases(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(restrict_demo),
):
    """Export all industry cases as a single Markdown file."""
    markdown_content = await outreach_service.export_industry_cases_markdown(db, current_user)
    return {"markdown": markdown_content}


@industry_router.post("/cases/import", response_model=IndustryCasesImportResponse)
async def import_industry_cases(
    data: IndustryCasesImport,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(restrict_demo),
):
    """Import industry cases from a single Markdown string."""
    result = await outreach_service.import_industry_cases_markdown(db, current_user, data.markdown_content)
    return result


@industry_router.patch("/{industry_id}", response_model=IndustryResponse)
async def update_industry(
    industry_id: int,
    data: IndustryUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(restrict_demo),
):
    industry = await outreach_service.update_industry(db, industry_id, data, current_user)
    if industry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Industry not found")
    return industry


@industry_router.delete("/{industry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_industry(
    industry_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(restrict_demo),
):
    deleted = await outreach_service.delete_industry(db, industry_id, current_user)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Industry not found")


@industry_router.post("/{industry_id}/generate-instructions", response_model=IndustryResponse)
async def generate_industry_instructions_endpoint(
    industry_id: int,
    data: IndustryInstructionGenerateRequest = IndustryInstructionGenerateRequest(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(restrict_demo),
):
    """Generate markdown prompt instructions for an industry using the User Profile."""
    try:
        industry = await generate_industry_instructions_for_industry(
            db, current_user, industry_id, language=data.language
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error("Industry instruction generation failed for industry %d: %s", industry_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Generation failed: {e}",
        )
    
    return industry


# ── Batch Outreach ──────────────────────────────────────────────────────────

batch_router = APIRouter(prefix="/api/outreach/batch", tags=["outreach"])


@batch_router.post("/prepare", response_model=BatchPrepareResponse)
async def prepare_batch_endpoint(
    data: BatchPrepareRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(restrict_demo),
):
    """Filter leads, generate missing proposals, return preview for editing."""
    try:
        result = await prepare_batch(db, data, current_user)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error("Batch prepare failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Batch preparation failed: {e}",
        )
    return result


@batch_router.post("/send", response_model=BatchJobResponse)
async def send_batch_endpoint(
    data: BatchSendRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(restrict_demo),
):
    """Start batch send job. Emails are sent in background with rate limiting."""
    try:
        job = await start_batch_send(db, data.job_id, data.items, current_user)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Batch job not found")

    # Return fresh status
    result = await get_batch_job(db, job.id, current_user)
    return result


@batch_router.get("/{job_id}", response_model=BatchJobResponse)
async def get_batch_status(
    job_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(restrict_demo),
):
    """Get batch job status with per-item progress."""
    result = await get_batch_job(db, job_id, current_user)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Batch job not found")
    return result


@batch_router.post("/{job_id}/pause", response_model=BatchJobResponse)
async def pause_batch_endpoint(
    job_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(restrict_demo),
):
    """Pause a running batch send."""
    try:
        job = await pause_batch(db, job_id, current_user)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Batch job not found")

    result = await get_batch_job(db, job.id, current_user)
    return result


@batch_router.post("/{job_id}/cancel", response_model=BatchJobResponse)
async def cancel_batch_endpoint(
    job_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(restrict_demo),
):
    """Cancel a batch send. Remaining items are skipped."""
    try:
        job = await cancel_batch(db, job_id, current_user)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Batch job not found")

    result = await get_batch_job(db, job.id, current_user)
    return result
