from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.knowledge_base import KBDocumentCreate, KBDocumentResponse, KBDocumentUpdate
from app.services import knowledge_base as kb_service

router = APIRouter(prefix="/api/knowledge-base", tags=["knowledge-base"])


@router.get("/", response_model=list[KBDocumentResponse])
async def list_documents(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await kb_service.list_documents(db, current_user)


@router.get("/{slug}", response_model=KBDocumentResponse)
async def get_document(
    slug: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = await kb_service.get_document(db, current_user, slug)
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return doc


@router.post("/", response_model=KBDocumentResponse, status_code=status.HTTP_201_CREATED)
async def create_document(
    data: KBDocumentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return await kb_service.create_document(db, current_user, data)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Document with this slug already exists",
        )


@router.put("/{slug}", response_model=KBDocumentResponse)
async def update_document(
    slug: str,
    data: KBDocumentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = await kb_service.update_document(db, current_user, slug, data)
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return doc


@router.delete("/{slug}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    slug: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await kb_service.delete_document(db, current_user, slug)
    if result == "not_found":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    if result == "cannot_delete_default":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot delete default documents. Use reset to restore original content.",
        )


@router.post("/{slug}/reset", response_model=KBDocumentResponse)
async def reset_document(
    slug: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = await kb_service.reset_document(db, current_user, slug)
    if doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found or not a default document",
        )
    return doc
