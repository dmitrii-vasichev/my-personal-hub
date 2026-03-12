from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.tag import TagCreate, TagResponse, TagUpdate
from app.services import tag as tag_service

router = APIRouter(prefix="/api/tags", tags=["tags"])


@router.get("/", response_model=list[TagResponse])
async def list_tags(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await tag_service.get_user_tags(db, current_user.id)


@router.post("/", response_model=TagResponse, status_code=status.HTTP_201_CREATED)
async def create_tag(
    data: TagCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tag = await tag_service.create_tag(db, current_user.id, data)
    # Return with task_count=0 for newly created tag
    return {
        "id": tag.id,
        "name": tag.name,
        "color": tag.color,
        "created_at": tag.created_at,
        "task_count": 0,
    }


@router.patch("/{tag_id}", response_model=TagResponse)
async def update_tag(
    tag_id: int,
    data: TagUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tag = await tag_service.update_tag(db, tag_id, current_user.id, data)
    # Re-fetch with task_count
    tags = await tag_service.get_user_tags(db, current_user.id)
    return next(t for t in tags if t["id"] == tag.id)


@router.delete("/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tag(
    tag_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await tag_service.delete_tag(db, tag_id, current_user.id)
