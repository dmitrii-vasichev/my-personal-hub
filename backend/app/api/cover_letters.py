from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.resume import CoverLetterGenerateRequest, CoverLetterResponse
from app.services import resume as resume_service

router = APIRouter(prefix="/api/cover-letters", tags=["cover-letters"])


@router.post("/generate", response_model=CoverLetterResponse, status_code=status.HTTP_201_CREATED)
async def generate_cover_letter(
    data: CoverLetterGenerateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        cl = await resume_service.generate_cover_letter(db, current_user, data.application_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Cover letter generation failed: {exc}",
        )
    return cl


@router.get("/application/{application_id}", response_model=list[CoverLetterResponse])
async def list_cover_letters(
    application_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        letters = await resume_service.get_cover_letters(db, current_user, application_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    return letters
