from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.resume import ResumeGenerateRequest, ResumeResponse
from app.services import resume as resume_service

router = APIRouter(prefix="/api/resumes", tags=["resumes"])


@router.post("/generate", response_model=ResumeResponse, status_code=status.HTTP_201_CREATED)
async def generate_resume(
    data: ResumeGenerateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        resume = await resume_service.generate_resume(db, current_user, data.application_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI generation failed: {exc}",
        )
    return resume


@router.get("/application/{application_id}", response_model=list[ResumeResponse])
async def list_resumes(
    application_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        resumes = await resume_service.get_resumes(db, current_user, application_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    return resumes


@router.get("/{resume_id}/pdf")
async def download_pdf(
    resume_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    resume = await resume_service.get_resume(db, current_user, resume_id)
    if not resume:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found")
    try:
        pdf_bytes = resume_service.generate_pdf(resume.resume_json)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"PDF generation failed: {exc}",
        )
    name = resume.resume_json.get("contact", {}).get("name", "resume")
    filename = f"{name.lower().replace(' ', '_')}_v{resume.version}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/{resume_id}/ats-audit", response_model=ResumeResponse)
async def ats_audit(
    resume_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        resume = await resume_service.run_ats_audit(db, current_user, resume_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"ATS audit failed: {exc}",
        )
    return resume


@router.post("/{resume_id}/gap-analysis", response_model=ResumeResponse)
async def gap_analysis(
    resume_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        resume = await resume_service.run_gap_analysis(db, current_user, resume_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Gap analysis failed: {exc}",
        )
    return resume
