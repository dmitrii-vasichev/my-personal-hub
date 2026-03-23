from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/api/health")
async def health_check():
    """Health check — no auth required."""
    return {"status": "ok"}
