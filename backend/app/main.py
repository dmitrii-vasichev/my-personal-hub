import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.analytics import router as analytics_router
from app.api.dashboard import router as dashboard_router
from app.api.profile import router as profile_router
from app.api.knowledge_base import router as knowledge_base_router
from app.api.notes import router as notes_router
from app.api.tags import router as tags_router
from app.api.task_analytics import router as task_analytics_router
from app.api.pulse_settings import router as pulse_settings_router
from app.api.pulse_digests import router as pulse_digests_router
from app.api.garmin import dashboard_router as vitals_dashboard_router
from app.api.garmin import router as garmin_router
from app.api.pulse_sources import router as pulse_sources_router
from app.api.telegram import router as telegram_router
from app.api.calendar import router as calendar_router
from app.api.health import router as health_router
from app.api.auth import router as auth_router
from app.api.cover_letters import router as cover_letters_router
from app.api.jobs import router as jobs_router
from app.api.resumes import router as resumes_router
from app.api.search import router as search_router
from app.api.settings import router as settings_router
from app.api.tasks import router as tasks_router
from app.api.users import router as users_router
from app.core.config import settings
from app.core.scheduler import scheduler, schedule_garmin_sync, schedule_user_digest, schedule_user_polling

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(application: FastAPI):
    # Startup: start scheduler and restore polling jobs
    scheduler.start()
    logger.info("Scheduler started")
    try:
        from app.core.database import async_session_factory
        from app.models.telegram import PulseSettings
        from sqlalchemy import select

        async with async_session_factory() as db:
            result = await db.execute(select(PulseSettings))
            all_settings = result.scalars().all()
            for ps in all_settings:
                schedule_user_polling(ps.user_id, ps.polling_interval_minutes)
                hour = ps.digest_time.hour if ps.digest_time else 9
                minute = ps.digest_time.minute if ps.digest_time else 0
                schedule_user_digest(
                    ps.user_id,
                    schedule=ps.digest_schedule,
                    hour=hour,
                    minute=minute,
                    day_of_week=ps.digest_day,
                    interval_days=ps.digest_interval_days,
                    timezone=ps.timezone or "America/Denver",
                )
            if all_settings:
                logger.info("Restored polling + digest jobs for %d users", len(all_settings))

        # Restore Garmin sync jobs
        from app.models.garmin import GarminConnection
        from app.models.telegram import PulseDigest

        garmin_result = await db.execute(
            select(GarminConnection).where(GarminConnection.is_active.is_(True))
        )
        garmin_conns = garmin_result.scalars().all()
        for gc in garmin_conns:
            schedule_garmin_sync(gc.user_id, gc.sync_interval_minutes)
        if garmin_conns:
            logger.info("Restored Garmin sync jobs for %d users", len(garmin_conns))

        # Auto-seed vitals for demo user if missing
        from app.models.user import User, UserRole

        async with async_session_factory() as seed_db:
            demo_result = await seed_db.execute(
                select(User).where(User.role == UserRole.demo)
            )
            demo_user = demo_result.scalar_one_or_none()
            if demo_user:
                vitals_result = await seed_db.execute(
                    select(GarminConnection).where(
                        GarminConnection.user_id == demo_user.id
                    )
                )
                if vitals_result.scalar_one_or_none() is None:
                    from app.scripts.seed_demo import create_vitals_data

                    await create_vitals_data(seed_db, demo_user.id)
                    await seed_db.commit()
                    logger.info("Auto-seeded vitals data for demo user")

                # Auto-seed pulse data for demo user if missing
                pulse_result = await seed_db.execute(
                    select(PulseDigest).where(
                        PulseDigest.user_id == demo_user.id
                    )
                )
                if pulse_result.first() is None:
                    from app.scripts.seed_demo import create_pulse_data

                    await create_pulse_data(seed_db, demo_user.id)
                    await seed_db.commit()
                    logger.info("Auto-seeded pulse data for demo user")

        # Schedule daily TTL cleanup at 03:00
        scheduler.add_job(
            "app.services.pulse_scheduler:run_ttl_cleanup",
            "cron",
            hour=3,
            minute=0,
            id="pulse_ttl_cleanup",
            replace_existing=True,
        )

        # Schedule daily briefing cleanup at 03:15
        scheduler.add_job(
            "app.services.vitals_briefing:run_briefing_cleanup",
            "cron",
            hour=3,
            minute=15,
            id="vitals_briefing_cleanup",
            replace_existing=True,
        )
    except Exception as e:
        logger.warning("Could not restore polling jobs: %s", e)

    yield

    # Shutdown
    scheduler.shutdown(wait=False)
    logger.info("Scheduler stopped")


app = FastAPI(title="Personal Hub API", version="0.1.0", lifespan=lifespan)

app.include_router(health_router)
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(tasks_router)
app.include_router(jobs_router)
app.include_router(settings_router)
app.include_router(search_router)
app.include_router(resumes_router)
app.include_router(cover_letters_router)
app.include_router(analytics_router)
app.include_router(task_analytics_router)
app.include_router(calendar_router)
app.include_router(dashboard_router)
app.include_router(profile_router)
app.include_router(knowledge_base_router)
app.include_router(notes_router)
app.include_router(tags_router)
app.include_router(telegram_router)
app.include_router(pulse_sources_router)
app.include_router(pulse_settings_router)
app.include_router(pulse_digests_router)
app.include_router(garmin_router)
app.include_router(vitals_dashboard_router)

_cors_origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
