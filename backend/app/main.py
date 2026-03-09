from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.analytics import router as analytics_router
from app.api.applications import router as applications_router
from app.api.auth import router as auth_router
from app.api.cover_letters import router as cover_letters_router
from app.api.jobs import router as jobs_router
from app.api.resumes import router as resumes_router
from app.api.search import router as search_router
from app.api.settings import router as settings_router
from app.api.tasks import router as tasks_router
from app.api.users import router as users_router
from app.core.config import settings

app = FastAPI(title="Personal Hub API", version="0.1.0")

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(tasks_router)
app.include_router(jobs_router)
app.include_router(applications_router)
app.include_router(settings_router)
app.include_router(search_router)
app.include_router(resumes_router)
app.include_router(cover_letters_router)
app.include_router(analytics_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    return {"status": "ok", "env": settings.APP_ENV}
