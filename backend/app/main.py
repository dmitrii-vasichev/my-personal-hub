from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.api.jobs import router as jobs_router
from app.api.tasks import router as tasks_router
from app.api.users import router as users_router
from app.core.config import settings

app = FastAPI(title="Personal Hub API", version="0.1.0")

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(tasks_router)
app.include_router(jobs_router)

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
