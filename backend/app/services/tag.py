from fastapi import HTTPException, status
from sqlalchemy import delete, func, insert, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tag import Tag, TaskTag
from app.models.task import Task
from app.schemas.tag import BulkTagRequest, TagCreate, TagUpdate

MAX_TAGS_PER_USER = 20


async def get_user_tags(db: AsyncSession, user_id: int) -> list[dict]:
    """List all tags for user, ordered by name, with task_count."""
    count_sq = (
        select(func.count())
        .select_from(TaskTag)
        .where(TaskTag.tag_id == Tag.id)
        .correlate(Tag)
        .scalar_subquery()
    )
    stmt = (
        select(Tag, count_sq.label("task_count"))
        .where(Tag.user_id == user_id)
        .order_by(Tag.name)
    )
    result = await db.execute(stmt)
    rows = result.all()
    return [
        {
            "id": tag.id,
            "name": tag.name,
            "color": tag.color,
            "created_at": tag.created_at,
            "task_count": task_count,
        }
        for tag, task_count in rows
    ]


async def get_tag(db: AsyncSession, tag_id: int, user_id: int) -> Tag:
    """Get a single tag by id, validate ownership."""
    stmt = select(Tag).where(Tag.id == tag_id, Tag.user_id == user_id)
    result = await db.execute(stmt)
    tag = result.scalar_one_or_none()
    if not tag:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found")
    return tag


async def create_tag(db: AsyncSession, user_id: int, data: TagCreate) -> Tag:
    """Create a tag. Validate unique name (case-insensitive) and 20-tag limit."""
    # Check tag limit
    count_stmt = select(func.count()).select_from(Tag).where(Tag.user_id == user_id)
    count = (await db.execute(count_stmt)).scalar() or 0
    if count >= MAX_TAGS_PER_USER:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tag limit reached (max {MAX_TAGS_PER_USER})",
        )

    # Check unique name (case-insensitive)
    dup_stmt = select(Tag).where(
        Tag.user_id == user_id, func.lower(Tag.name) == data.name.lower()
    )
    existing = (await db.execute(dup_stmt)).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Tag with this name already exists",
        )

    tag = Tag(user_id=user_id, name=data.name, color=data.color)
    db.add(tag)
    await db.commit()
    await db.refresh(tag)
    return tag


async def update_tag(
    db: AsyncSession, tag_id: int, user_id: int, data: TagUpdate
) -> Tag:
    """Update a tag. Validate ownership + unique name."""
    tag = await get_tag(db, tag_id, user_id)

    if data.name is not None and data.name.lower() != tag.name.lower():
        dup_stmt = select(Tag).where(
            Tag.user_id == user_id,
            func.lower(Tag.name) == data.name.lower(),
            Tag.id != tag_id,
        )
        existing = (await db.execute(dup_stmt)).scalar_one_or_none()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Tag with this name already exists",
            )
        tag.name = data.name

    if data.color is not None:
        tag.color = data.color

    await db.commit()
    await db.refresh(tag)
    return tag


async def delete_tag(db: AsyncSession, tag_id: int, user_id: int) -> None:
    """Delete a tag. Validate ownership. CASCADE handles task_tags."""
    tag = await get_tag(db, tag_id, user_id)
    await db.delete(tag)
    await db.commit()


async def sync_task_tags(
    db: AsyncSession, task_id: int, tag_ids: list[int], user_id: int
) -> None:
    """Replace all tags for a task with the given tag_ids. Validate tag ownership."""
    if tag_ids:
        # Validate all tags belong to user
        stmt = select(func.count()).select_from(Tag).where(
            Tag.id.in_(tag_ids), Tag.user_id == user_id
        )
        count = (await db.execute(stmt)).scalar() or 0
        if count != len(tag_ids):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="One or more tags not found or not owned by user",
            )

    # Delete existing
    await db.execute(delete(TaskTag).where(TaskTag.task_id == task_id))

    # Insert new
    if tag_ids:
        await db.execute(
            insert(TaskTag),
            [{"task_id": task_id, "tag_id": tid} for tid in tag_ids],
        )


async def bulk_tag(
    db: AsyncSession, user_id: int, data: BulkTagRequest
) -> int:
    """Add/remove tags from multiple tasks. Returns affected_tasks count."""
    # Validate all tasks belong to user
    task_stmt = select(func.count()).select_from(Task).where(
        Task.id.in_(data.task_ids), Task.user_id == user_id
    )
    task_count = (await db.execute(task_stmt)).scalar() or 0
    if task_count != len(data.task_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or more tasks not found or not owned by user",
        )

    all_tag_ids = set(data.add_tag_ids) | set(data.remove_tag_ids)
    if all_tag_ids:
        tag_stmt = select(func.count()).select_from(Tag).where(
            Tag.id.in_(all_tag_ids), Tag.user_id == user_id
        )
        tag_count = (await db.execute(tag_stmt)).scalar() or 0
        if tag_count != len(all_tag_ids):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="One or more tags not found or not owned by user",
            )

    # Remove tags
    if data.remove_tag_ids:
        await db.execute(
            delete(TaskTag).where(
                TaskTag.task_id.in_(data.task_ids),
                TaskTag.tag_id.in_(data.remove_tag_ids),
            )
        )

    # Add tags (ignore duplicates via INSERT ... ON CONFLICT DO NOTHING-style)
    if data.add_tag_ids:
        # Get existing pairs to avoid duplicates
        existing_stmt = select(TaskTag.task_id, TaskTag.tag_id).where(
            TaskTag.task_id.in_(data.task_ids),
            TaskTag.tag_id.in_(data.add_tag_ids),
        )
        existing = set((await db.execute(existing_stmt)).all())

        new_pairs = [
            {"task_id": tid, "tag_id": tag_id}
            for tid in data.task_ids
            for tag_id in data.add_tag_ids
            if (tid, tag_id) not in existing
        ]
        if new_pairs:
            await db.execute(insert(TaskTag), new_pairs)

    await db.commit()
    return len(data.task_ids)
