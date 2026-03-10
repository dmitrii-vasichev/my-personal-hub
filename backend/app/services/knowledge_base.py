"""AI Knowledge Base service — CRUD for KB documents with auto-seeding."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional, Union

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.knowledge_base import AiKnowledgeBase
from app.models.user import User
from app.schemas.knowledge_base import KBDocumentCreate, KBDocumentUpdate
from app.services.kb_defaults import get_default_content, seed_kb_for_user


async def _ensure_seeded(db: AsyncSession, user: User) -> None:
    """Auto-seed KB docs on first access if user has none."""
    result = await db.execute(
        select(AiKnowledgeBase.id).where(AiKnowledgeBase.user_id == user.id).limit(1)
    )
    if result.scalar_one_or_none() is None:
        await seed_kb_for_user(db, user.id)


async def list_documents(db: AsyncSession, user: User) -> list[AiKnowledgeBase]:
    await _ensure_seeded(db, user)
    result = await db.execute(
        select(AiKnowledgeBase)
        .where(AiKnowledgeBase.user_id == user.id)
        .order_by(AiKnowledgeBase.slug)
    )
    return list(result.scalars().all())


async def get_document(db: AsyncSession, user: User, slug: str) -> Optional[AiKnowledgeBase]:
    await _ensure_seeded(db, user)
    result = await db.execute(
        select(AiKnowledgeBase).where(
            AiKnowledgeBase.user_id == user.id,
            AiKnowledgeBase.slug == slug,
        )
    )
    return result.scalar_one_or_none()


async def create_document(
    db: AsyncSession, user: User, data: KBDocumentCreate
) -> AiKnowledgeBase:
    doc = AiKnowledgeBase(
        user_id=user.id,
        slug=data.slug,
        title=data.title,
        content=data.content,
        is_default=False,
        used_by=data.used_by,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)
    return doc


async def update_document(
    db: AsyncSession, user: User, slug: str, data: KBDocumentUpdate
) -> Optional[AiKnowledgeBase]:
    doc = await get_document(db, user, slug)
    if doc is None:
        return None

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(doc, field, value)

    doc.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(doc)
    return doc


async def delete_document(db: AsyncSession, user: User, slug: str) -> bool | str:
    """Delete a custom KB document. Returns True on success, error string for defaults."""
    doc = await get_document(db, user, slug)
    if doc is None:
        return "not_found"
    if doc.is_default:
        return "cannot_delete_default"

    await db.delete(doc)
    await db.commit()
    return True


async def reset_document(
    db: AsyncSession, user: User, slug: str
) -> Optional[AiKnowledgeBase]:
    """Reset a default document to its original content."""
    doc = await get_document(db, user, slug)
    if doc is None:
        return None

    default_content = get_default_content(slug)
    if default_content is None:
        return None  # not a default doc

    doc.content = default_content
    doc.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(doc)
    return doc


async def get_documents_for_operation(
    db: AsyncSession, user: User, operation: str
) -> list[AiKnowledgeBase]:
    """Return all KB documents where used_by includes the given operation."""
    await _ensure_seeded(db, user)
    all_docs = await list_documents(db, user)
    return [doc for doc in all_docs if operation in (doc.used_by or [])]
