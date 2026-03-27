from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import asc, desc, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.outreach import Industry, Lead, LeadStatus, LeadStatusHistory
from app.models.user import User, UserRole
from app.schemas.outreach import (
    IndustryCreate,
    IndustryUpdate,
    LeadCreate,
    LeadStatusChange,
    LeadUpdate,
)


def _exclude_demo_owners(owner_id_col):
    demo_ids = select(User.id).where(User.role == UserRole.demo)
    return ~owner_id_col.in_(demo_ids)


def _can_access(entity, user: User) -> bool:
    if user.role == UserRole.admin:
        return True
    return entity.user_id == user.id


def _user_filter(query, model, current_user: User):
    if current_user.role == UserRole.demo:
        return query.where(model.user_id == current_user.id)
    elif current_user.role == UserRole.admin:
        return query.where(_exclude_demo_owners(model.user_id))
    return query.where(model.user_id == current_user.id)


async def _load_lead(db: AsyncSession, lead_id: int) -> Lead | None:
    result = await db.execute(select(Lead).where(Lead.id == lead_id))
    return result.scalar_one_or_none()


async def _load_lead_full(db: AsyncSession, lead_id: int) -> Lead | None:
    result = await db.execute(
        select(Lead)
        .where(Lead.id == lead_id)
        .options(selectinload(Lead.status_history), selectinload(Lead.industry))
    )
    return result.scalar_one_or_none()


# ── Lead CRUD ────────────────────────────────────────────────────────────────


async def create_lead(
    db: AsyncSession, data: LeadCreate, current_user: User
) -> Lead:
    lead = Lead(
        user_id=current_user.id,
        business_name=data.business_name,
        industry_id=data.industry_id,
        contact_person=data.contact_person,
        email=data.email,
        phone=data.phone,
        website=data.website,
        service_description=data.service_description,
        source=data.source,
        source_detail=data.source_detail,
        notes=data.notes,
        status=LeadStatus.new.value,
    )
    db.add(lead)
    await db.flush()

    history = LeadStatusHistory(
        lead_id=lead.id,
        old_status=None,
        new_status=LeadStatus.new.value,
    )
    db.add(history)
    await db.commit()
    return await _load_lead_full(db, lead.id)  # type: ignore[return-value]


async def batch_create_leads(
    db: AsyncSession, items: list[LeadCreate], current_user: User
) -> list[Lead]:
    """Create multiple leads in a single transaction (used after PDF parsing)."""
    created: list[Lead] = []
    for data in items:
        lead = Lead(
            user_id=current_user.id,
            business_name=data.business_name,
            industry_id=data.industry_id,
            contact_person=data.contact_person,
            email=data.email,
            phone=data.phone,
            website=data.website,
            service_description=data.service_description,
            source=data.source,
            source_detail=data.source_detail,
            notes=data.notes,
            status=LeadStatus.new.value,
        )
        db.add(lead)
        await db.flush()

        history = LeadStatusHistory(
            lead_id=lead.id,
            old_status=None,
            new_status=LeadStatus.new.value,
        )
        db.add(history)
        created.append(lead)

    await db.commit()

    # Reload all with relationships
    result = []
    for lead in created:
        full = await _load_lead_full(db, lead.id)
        if full:
            result.append(full)
    return result


async def get_lead(
    db: AsyncSession, lead_id: int, current_user: User
) -> Lead | None:
    lead = await _load_lead_full(db, lead_id)
    if lead is None or not _can_access(lead, current_user):
        return None
    return lead


async def update_lead(
    db: AsyncSession, lead_id: int, data: LeadUpdate, current_user: User
) -> Lead | None:
    lead = await _load_lead(db, lead_id)
    if lead is None or not _can_access(lead, current_user):
        return None

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(lead, field, value)

    lead.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return await _load_lead_full(db, lead_id)


async def delete_lead(
    db: AsyncSession, lead_id: int, current_user: User
) -> bool:
    lead = await _load_lead(db, lead_id)
    if lead is None or not _can_access(lead, current_user):
        return False
    await db.delete(lead)
    await db.commit()
    return True


async def list_leads(
    db: AsyncSession,
    current_user: User,
    search: Optional[str] = None,
    status: Optional[str] = None,
    industry_id: Optional[int] = None,
    source: Optional[str] = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
) -> list[Lead]:
    q = select(Lead).options(
        selectinload(Lead.status_history), selectinload(Lead.industry)
    )
    q = _user_filter(q, Lead, current_user)

    if search:
        pattern = f"%{search}%"
        q = q.where(
            or_(
                Lead.business_name.ilike(pattern),
                Lead.contact_person.ilike(pattern),
                Lead.email.ilike(pattern),
                Lead.service_description.ilike(pattern),
            )
        )

    if status:
        status_values = [s.strip() for s in status.split(",") if s.strip()]
        if status_values:
            q = q.where(Lead.status.in_(status_values))

    if industry_id is not None:
        q = q.where(Lead.industry_id == industry_id)

    if source:
        q = q.where(Lead.source.ilike(source))

    allowed_sort = {"created_at", "updated_at", "business_name", "status"}
    sort_field = sort_by if sort_by in allowed_sort else "created_at"
    sort_col = getattr(Lead, sort_field, Lead.created_at)
    order_fn = asc if sort_order == "asc" else desc
    q = q.order_by(order_fn(sort_col))

    result = await db.execute(q)
    return list(result.scalars().all())


# ── Status ───────────────────────────────────────────────────────────────────


async def change_lead_status(
    db: AsyncSession, lead_id: int, data: LeadStatusChange, current_user: User
) -> Lead | None:
    lead = await _load_lead(db, lead_id)
    if lead is None or not _can_access(lead, current_user):
        return None

    if data.new_status.value == lead.status:
        return await _load_lead_full(db, lead_id)

    old_status = lead.status

    lead.status = data.new_status.value
    lead.updated_at = datetime.now(timezone.utc)

    history = LeadStatusHistory(
        lead_id=lead.id,
        old_status=old_status,
        new_status=data.new_status.value,
        comment=data.comment,
    )
    db.add(history)
    await db.commit()
    return await _load_lead_full(db, lead_id)


# ── Kanban ───────────────────────────────────────────────────────────────────


async def get_kanban(
    db: AsyncSession, current_user: User
) -> dict[str, list[Lead]]:
    q = select(Lead)
    q = _user_filter(q, Lead, current_user)

    result = await db.execute(q)
    leads = result.scalars().all()

    buckets: dict[str, list[Lead]] = {s.value: [] for s in LeadStatus}
    for lead in leads:
        if lead.status in buckets:
            buckets[lead.status].append(lead)

    return buckets


# ── History ──────────────────────────────────────────────────────────────────


async def get_lead_history(
    db: AsyncSession, lead_id: int, current_user: User
) -> list[LeadStatusHistory] | None:
    lead = await _load_lead(db, lead_id)
    if lead is None or not _can_access(lead, current_user):
        return None

    result = await db.execute(
        select(LeadStatusHistory)
        .where(LeadStatusHistory.lead_id == lead_id)
        .order_by(LeadStatusHistory.changed_at.asc())
    )
    return list(result.scalars().all())


# ── Industry CRUD ────────────────────────────────────────────────────────────


async def create_industry(
    db: AsyncSession, data: IndustryCreate, current_user: User
) -> Industry:
    industry = Industry(
        user_id=current_user.id,
        name=data.name,
        slug=data.slug,
        drive_file_id=data.drive_file_id,
        description=data.description,
    )
    db.add(industry)
    await db.commit()
    await db.refresh(industry)
    return industry


async def list_industries(
    db: AsyncSession, current_user: User
) -> list[Industry]:
    q = select(Industry)
    q = _user_filter(q, Industry, current_user)
    q = q.order_by(Industry.name.asc())
    result = await db.execute(q)
    return list(result.scalars().all())


async def update_industry(
    db: AsyncSession, industry_id: int, data: IndustryUpdate, current_user: User
) -> Industry | None:
    result = await db.execute(select(Industry).where(Industry.id == industry_id))
    industry = result.scalar_one_or_none()
    if industry is None or not _can_access(industry, current_user):
        return None

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(industry, field, value)

    industry.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(industry)
    return industry


async def delete_industry(
    db: AsyncSession, industry_id: int, current_user: User
) -> bool:
    result = await db.execute(select(Industry).where(Industry.id == industry_id))
    industry = result.scalar_one_or_none()
    if industry is None or not _can_access(industry, current_user):
        return False
    await db.delete(industry)
    await db.commit()
    return True
