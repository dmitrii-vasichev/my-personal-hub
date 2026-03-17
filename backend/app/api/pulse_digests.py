from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.encryption import decrypt_value
from app.models.settings import UserSettings
from app.models.telegram import PulseDigest, PulseSettings
from app.models.user import User
from app.schemas.pulse_digest import (
    DigestGenerateRequest,
    DigestGenerateResponse,
    DigestListResponse,
    DigestResponse,
)
from app.services.ai import get_llm_client
from app.services.pulse_digest import generate_digest

router = APIRouter(prefix="/api/pulse/digests", tags=["pulse-digests"])


async def _get_llm_client(db: AsyncSession, user_id: int):
    """Resolve the user's LLM client from settings."""
    result = await db.execute(
        select(UserSettings).where(UserSettings.user_id == user_id)
    )
    settings = result.scalar_one_or_none()
    if not settings or not settings.llm_provider:
        raise HTTPException(status_code=503, detail="LLM provider not configured")

    key_field = f"api_key_{settings.llm_provider}"
    encrypted_key = getattr(settings, key_field, None)
    if not encrypted_key:
        raise HTTPException(status_code=503, detail="LLM API key not configured")

    try:
        api_key = decrypt_value(encrypted_key)
        return get_llm_client(settings.llm_provider, api_key)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"LLM unavailable: {e}")


@router.get("/", response_model=DigestListResponse)
async def list_digests(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    category: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(PulseDigest).where(PulseDigest.user_id == current_user.id)
    count_query = select(func.count(PulseDigest.id)).where(
        PulseDigest.user_id == current_user.id
    )
    if category:
        query = query.where(PulseDigest.category == category)
        count_query = count_query.where(PulseDigest.category == category)

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    result = await db.execute(
        query.order_by(PulseDigest.generated_at.desc()).offset(offset).limit(limit)
    )
    items = list(result.scalars().all())

    return DigestListResponse(
        items=[DigestResponse.model_validate(d) for d in items],
        total=total,
    )


@router.get("/latest", response_model=DigestResponse | None)
async def get_latest_digest(
    category: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(PulseDigest).where(PulseDigest.user_id == current_user.id)
    if category:
        query = query.where(PulseDigest.category == category)
    query = query.order_by(PulseDigest.generated_at.desc()).limit(1)

    result = await db.execute(query)
    digest = result.scalar_one_or_none()
    return digest


@router.get("/{digest_id}", response_model=DigestResponse)
async def get_digest(
    digest_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(PulseDigest).where(
            PulseDigest.id == digest_id,
            PulseDigest.user_id == current_user.id,
        )
    )
    digest = result.scalar_one_or_none()
    if not digest:
        raise HTTPException(status_code=404, detail="Digest not found")
    return digest


@router.post("/generate", response_model=DigestGenerateResponse)
async def trigger_generate(
    body: DigestGenerateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    llm = await _get_llm_client(db, current_user.id)

    # Load PulseSettings for custom prompts
    ps_result = await db.execute(
        select(PulseSettings).where(PulseSettings.user_id == current_user.id)
    )
    pulse_settings = ps_result.scalar_one_or_none()

    try:
        digest = await generate_digest(
            db, current_user.id, llm, body.category, pulse_settings=pulse_settings
        )
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

    if digest is None:
        return DigestGenerateResponse(
            digest=None, message="No new messages to digest"
        )

    await db.commit()

    return DigestGenerateResponse(
        digest=DigestResponse.model_validate(digest),
        message=f"Digest generated from {digest.message_count} messages",
    )
