from fastapi import APIRouter

from app.core.config import settings

router = APIRouter(tags=["health"])


@router.get("/api/health")
async def health_check():
    """Health check — no auth required."""
    return {"status": "ok", "env": settings.APP_ENV}
