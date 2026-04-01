from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import and_, asc, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.outreach import ActivityType, Industry, Lead, LeadActivity, LeadStatus, LeadStatusHistory
from app.models.user import User, UserRole
from app.schemas.outreach import (
    ActivityCreate,
    DuplicateMatch,
    IndustryBreakdown,
    IndustryCreate,
    IndustryUpdate,
    LeadCreate,
    LeadStatusChange,
    LeadUpdate,
    OutreachAnalytics,
    SendEmailRequest,
    StatusCount,
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


# ── Activities ──────────────────────────────────────────────────────────────


async def create_activity(
    db: AsyncSession, lead_id: int, data: ActivityCreate, current_user: User
) -> LeadActivity | None:
    lead = await _load_lead(db, lead_id)
    if lead is None or not _can_access(lead, current_user):
        return None

    activity = LeadActivity(
        lead_id=lead_id,
        activity_type=data.activity_type.value,
        subject=data.subject,
        body=data.body,
    )
    db.add(activity)
    await db.commit()
    await db.refresh(activity)
    return activity


async def list_activities(
    db: AsyncSession, lead_id: int, current_user: User
) -> list[LeadActivity] | None:
    lead = await _load_lead(db, lead_id)
    if lead is None or not _can_access(lead, current_user):
        return None

    result = await db.execute(
        select(LeadActivity)
        .where(LeadActivity.lead_id == lead_id)
        .order_by(LeadActivity.created_at.desc())
    )
    return list(result.scalars().all())


async def delete_activity(
    db: AsyncSession, activity_id: int, current_user: User
) -> bool:
    result = await db.execute(
        select(LeadActivity).where(LeadActivity.id == activity_id)
    )
    activity = result.scalar_one_or_none()
    if activity is None:
        return False

    lead = await _load_lead(db, activity.lead_id)
    if lead is None or not _can_access(lead, current_user):
        return False

    await db.delete(activity)
    await db.commit()
    return True


# ── Gmail send ─────────────────────────────────────────────────────────────


async def send_email_to_lead(
    db: AsyncSession,
    lead_id: int,
    data: SendEmailRequest,
    current_user: User,
    credentials,
) -> LeadActivity | None:
    """Send email via Gmail and auto-log as outbound_email activity.

    Also auto-transitions status: new → contacted on first send.
    Returns the created activity, or None if lead not found / no access.
    """
    from app.services.google_gmail import send_email

    lead = await _load_lead(db, lead_id)
    if lead is None or not _can_access(lead, current_user):
        return None

    if not lead.email:
        raise ValueError("Lead has no email address")

    result = await send_email(
        credentials=credentials,
        to=lead.email,
        subject=data.subject,
        body=data.body,
    )

    activity = LeadActivity(
        lead_id=lead_id,
        activity_type=ActivityType.outbound_email.value,
        subject=data.subject,
        body=data.body,
        gmail_message_id=result["message_id"],
        gmail_thread_id=result["thread_id"],
    )
    db.add(activity)

    # Auto-status transition: new → contacted
    if lead.status == LeadStatus.new.value:
        old_status = lead.status
        lead.status = LeadStatus.contacted.value
        lead.updated_at = datetime.now(timezone.utc)
        history = LeadStatusHistory(
            lead_id=lead.id,
            old_status=old_status,
            new_status=LeadStatus.contacted.value,
            comment="Auto: first email sent",
        )
        db.add(history)

    await db.commit()
    await db.refresh(activity)
    return activity


# ── Analytics ───────────────────────────────────────────────────────────────


async def get_analytics(
    db: AsyncSession, current_user: User
) -> OutreachAnalytics:
    """Compute outreach funnel metrics."""
    # Count by status
    q = (
        select(Lead.status, func.count(Lead.id))
        .where(Lead.user_id == current_user.id)
        .group_by(Lead.status)
    )
    result = await db.execute(q)
    status_rows = result.all()

    counts: dict[str, int] = {s.value: 0 for s in LeadStatus}
    for status_val, cnt in status_rows:
        counts[status_val] = cnt

    total = sum(counts.values())
    by_status = [StatusCount(status=s, count=c) for s, c in counts.items()]

    # Count by industry
    q_ind = (
        select(Industry.name, func.count(Lead.id))
        .join(Lead, Lead.industry_id == Industry.id)
        .where(Lead.user_id == current_user.id)
        .group_by(Industry.name)
        .order_by(func.count(Lead.id).desc())
    )
    result_ind = await db.execute(q_ind)
    by_industry = [
        IndustryBreakdown(industry_name=name, count=cnt)
        for name, cnt in result_ind.all()
    ]

    # Add "No industry" bucket
    no_ind_count = total - sum(b.count for b in by_industry)
    if no_ind_count > 0:
        by_industry.append(IndustryBreakdown(industry_name="Unassigned", count=no_ind_count))

    # Conversion rates
    responded = counts.get("responded", 0)
    negotiating = counts.get("negotiating", 0)
    won = counts.get("won", 0)

    # "contacted" means all leads that moved past new
    contacted_plus = total - counts.get("new", 0)
    # "responded" means responded + negotiating + won (those who progressed past responded)
    responded_plus = responded + negotiating + won

    conv_contacted_responded = (responded_plus / contacted_plus * 100) if contacted_plus > 0 else None
    conv_responded_negotiating = ((negotiating + won) / responded_plus * 100) if responded_plus > 0 else None

    return OutreachAnalytics(
        total=total,
        by_status=by_status,
        by_industry=by_industry,
        conversion_contacted_to_responded=round(conv_contacted_responded, 1) if conv_contacted_responded is not None else None,
        conversion_responded_to_negotiating=round(conv_responded_negotiating, 1) if conv_responded_negotiating is not None else None,
    )


# ── Duplicate Detection ─────────────────────────────────────────────────────


async def check_duplicates(
    db: AsyncSession,
    current_user: User,
    emails: list[str],
    phones: list[str],
    exclude_id: Optional[int] = None,
) -> list[DuplicateMatch]:
    """Find existing leads that share an email or phone with provided values."""
    emails_clean = [e.strip().lower() for e in emails if e and e.strip()]
    phones_clean = [_normalize_phone(p) for p in phones if p and p.strip()]

    if not emails_clean and not phones_clean:
        return []

    conditions = []
    if emails_clean:
        conditions.append(func.lower(Lead.email).in_(emails_clean))
    if phones_clean:
        conditions.append(Lead.phone.in_(phones_clean))

    q = select(Lead).where(and_(Lead.user_id == current_user.id, or_(*conditions)))
    if exclude_id is not None:
        q = q.where(Lead.id != exclude_id)

    result = await db.execute(q)
    existing = list(result.scalars().all())

    matches: list[DuplicateMatch] = []
    for lead in existing:
        if lead.email and lead.email.strip().lower() in emails_clean:
            matches.append(
                DuplicateMatch(
                    field="email",
                    value=lead.email,
                    existing_lead_id=lead.id,
                    existing_business_name=lead.business_name,
                )
            )
        lead_phone = _normalize_phone(lead.phone) if lead.phone else None
        if lead_phone and lead_phone in phones_clean:
            matches.append(
                DuplicateMatch(
                    field="phone",
                    value=lead.phone,
                    existing_lead_id=lead.id,
                    existing_business_name=lead.business_name,
                )
            )
    return matches


def _normalize_phone(phone: str | None) -> str:
    """Strip non-digit characters for phone comparison."""
    if not phone:
        return ""
    return "".join(c for c in phone if c.isdigit())


# ── Industry CRUD ────────────────────────────────────────────────────────────


async def create_industry(
    db: AsyncSession, data: IndustryCreate, current_user: User
) -> Industry:
    industry = Industry(
        user_id=current_user.id,
        name=data.name,
        slug=data.slug,
        prompt_instructions=data.prompt_instructions,
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


# ── Industry Cases Export/Import ──────────────────────────────────────────────


async def export_industry_cases_markdown(db: AsyncSession, current_user: User) -> str:
    industries = await list_industries(db, current_user)
    lines = []
    for ind in industries:
        lines.append(f"# {ind.name}")
        if ind.prompt_instructions and ind.prompt_instructions.strip():
            lines.append(ind.prompt_instructions.strip())
        else:
            lines.append("[No cases defined]")
        lines.append("")
    return "\n".join(lines)


async def import_industry_cases_markdown(
    db: AsyncSession, current_user: User, markdown_content: str
) -> dict[str, int]:
    import re
    
    industries = await list_industries(db, current_user)
    ind_map = {ind.name.strip().lower(): ind for ind in industries}
    
    # Split by markdown headers
    sections = re.split(r'^#\s+(.+)$', markdown_content, flags=re.MULTILINE)
    
    matched = 0
    updated = 0
    
    if len(sections) > 1:
        # First chunk is usually empty or preamble, headers start at index 1
        for i in range(1, len(sections), 2):
            header = sections[i].strip()
            # clean up content
            content = sections[i+1].strip() if i+1 < len(sections) else ""
            if content == "[No cases defined]":
                content = ""
                
            header_lower = header.lower()
            if header_lower in ind_map:
                matched += 1
                ind = ind_map[header_lower]
                if ind.prompt_instructions != content:
                    ind.prompt_instructions = content
                    ind.updated_at = datetime.now(timezone.utc)
                    updated += 1
                    
        await db.commit()
        
    return {"matched_count": matched, "updated_count": updated}
