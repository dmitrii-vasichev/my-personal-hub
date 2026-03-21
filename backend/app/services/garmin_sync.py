"""Garmin data sync service — fetch metrics, sleep, activities from Garmin API."""
from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone

from garminconnect import GarminConnectTooManyRequestsError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session_factory
from app.models.garmin import (
    GarminConnection,
    VitalsActivity,
    VitalsDailyMetric,
    VitalsSleep,
)
from app.services import garmin_auth
from app.services.garmin_auth import GarminRateLimitError

logger = logging.getLogger(__name__)


async def sync_user_data(db: AsyncSession, user_id: int) -> None:
    """Main sync function: fetch data from Garmin and upsert into DB."""
    # Load connection and set syncing status
    result = await db.execute(
        select(GarminConnection).where(GarminConnection.user_id == user_id)
    )
    conn = result.scalar_one_or_none()
    if conn is None or not conn.is_active:
        logger.warning("No active Garmin connection for user %s", user_id)
        return

    # Check rate-limit cooldown — skip sync entirely if still on cooldown
    if conn.rate_limited_until and conn.rate_limited_until > datetime.now(timezone.utc):
        logger.info(
            "Garmin sync skipped for user %s — rate limited until %s",
            user_id,
            conn.rate_limited_until.isoformat(),
        )
        return

    conn.sync_status = "syncing"
    await db.flush()

    try:
        client = await garmin_auth.get_garmin_client(db, user_id)

        today = date.today()
        yesterday = today - timedelta(days=1)

        # Determine activity date range: 7 days on first sync, 2 days on subsequent
        if conn.last_sync_at is None:
            activity_start = today - timedelta(days=7)
        else:
            activity_start = today - timedelta(days=2)

        # Sync daily metrics for today and yesterday
        for d in [yesterday, today]:
            await _sync_daily_metrics(db, user_id, client, d)

        # Sync sleep for today and yesterday
        for d in [yesterday, today]:
            await _sync_sleep(db, user_id, client, d)

        # Sync activities
        await _sync_activities(db, user_id, client, activity_start, today)

        conn.last_sync_at = datetime.now(timezone.utc)
        conn.sync_status = "success"
        conn.sync_error = None
        conn.rate_limited_until = None
        conn.consecutive_failures = 0
        await db.flush()
        logger.info("Garmin sync complete for user %s", user_id)

    except GarminRateLimitError:
        # Set cooldown and persist error state
        await garmin_auth.set_rate_limited(db, user_id)
        logger.warning("Garmin rate limited for user %s — cooldown set", user_id)
        raise

    except Exception as e:
        conn.sync_status = "error"
        conn.sync_error = str(e)
        await db.flush()
        logger.error("Garmin sync failed for user %s: %s", user_id, e)
        raise


async def _sync_daily_metrics(
    db: AsyncSession, user_id: int, client, target_date: date
) -> None:
    """Fetch daily metrics from Garmin and upsert VitalsDailyMetric."""
    date_str = target_date.isoformat()

    try:
        summary = client.get_user_summary(date_str)
    except GarminConnectTooManyRequestsError:
        raise GarminRateLimitError("429 on get_user_summary")
    except Exception as e:
        logger.warning("Failed to get user summary for %s: %s", date_str, e)
        summary = {}

    try:
        body_battery = client.get_body_battery(date_str, date_str)
    except GarminConnectTooManyRequestsError:
        raise GarminRateLimitError("429 on get_body_battery")
    except Exception as e:
        logger.warning("Failed to get body battery for %s: %s", date_str, e)
        body_battery = []

    try:
        max_metrics = client.get_max_metrics(date_str)
    except GarminConnectTooManyRequestsError:
        raise GarminRateLimitError("429 on get_max_metrics")
    except Exception as e:
        logger.warning("Failed to get max metrics for %s: %s", date_str, e)
        max_metrics = {}

    # Parse body battery (list of dicts with charged/drained values)
    bb_high = None
    bb_low = None
    if body_battery and isinstance(body_battery, list):
        bb_values = [
            entry.get("chargedValue", 0)
            for entry in body_battery
            if isinstance(entry, dict) and "chargedValue" in entry
        ]
        if bb_values:
            bb_high = max(bb_values)
            bb_low = min(bb_values)

    # Parse VO2 max
    vo2_max = None
    if isinstance(max_metrics, dict):
        generic = max_metrics.get("generic", {})
        if isinstance(generic, dict):
            vo2_max = generic.get("vo2MaxValue")

    # Build raw_json from all responses
    raw_json = {"summary": summary, "body_battery": body_battery, "max_metrics": max_metrics}

    # Upsert
    result = await db.execute(
        select(VitalsDailyMetric).where(
            VitalsDailyMetric.user_id == user_id,
            VitalsDailyMetric.date == target_date,
        )
    )
    metric = result.scalar_one_or_none()

    values = {
        "steps": summary.get("totalSteps"),
        "distance_m": summary.get("totalDistanceMeters"),
        "calories_active": summary.get("activeKilocalories"),
        "calories_total": summary.get("totalKilocalories"),
        "floors_climbed": summary.get("floorsAscended"),
        "intensity_minutes": summary.get("intensityMinutesGoal"),
        "resting_hr": summary.get("restingHeartRate"),
        "avg_hr": summary.get("averageHeartRate"),
        "max_hr": summary.get("maxHeartRate"),
        "min_hr": summary.get("minHeartRate"),
        "avg_stress": summary.get("averageStressLevel"),
        "max_stress": summary.get("maxStressLevel"),
        "body_battery_high": bb_high,
        "body_battery_low": bb_low,
        "vo2_max": vo2_max,
        "raw_json": raw_json,
    }

    if metric is None:
        metric = VitalsDailyMetric(user_id=user_id, date=target_date, **values)
        db.add(metric)
    else:
        for key, value in values.items():
            if value is not None:
                setattr(metric, key, value)

    await db.flush()


async def _sync_sleep(
    db: AsyncSession, user_id: int, client, target_date: date
) -> None:
    """Fetch sleep data from Garmin and upsert VitalsSleep."""
    date_str = target_date.isoformat()

    try:
        sleep_data = client.get_sleep_data(date_str)
    except GarminConnectTooManyRequestsError:
        raise GarminRateLimitError("429 on get_sleep_data")
    except Exception as e:
        logger.warning("Failed to get sleep data for %s: %s", date_str, e)
        return

    if not sleep_data or not isinstance(sleep_data, dict):
        return

    daily_sleep = sleep_data.get("dailySleepDTO", {})
    if not daily_sleep:
        return

    duration = daily_sleep.get("sleepTimeSeconds")
    if duration is None or duration == 0:
        return

    # Parse sleep start/end times
    start_ts = daily_sleep.get("sleepStartTimestampGMT")
    end_ts = daily_sleep.get("sleepEndTimestampGMT")
    start_time = (
        datetime.fromtimestamp(start_ts / 1000, tz=timezone.utc) if start_ts else None
    )
    end_time = (
        datetime.fromtimestamp(end_ts / 1000, tz=timezone.utc) if end_ts else None
    )

    values = {
        "duration_seconds": duration,
        "deep_seconds": daily_sleep.get("deepSleepSeconds"),
        "light_seconds": daily_sleep.get("lightSleepSeconds"),
        "rem_seconds": daily_sleep.get("remSleepSeconds"),
        "awake_seconds": daily_sleep.get("awakeSleepSeconds"),
        "sleep_score": daily_sleep.get("sleepScores", {}).get("overall", {}).get("value"),
        "start_time": start_time,
        "end_time": end_time,
        "raw_json": sleep_data,
    }

    result = await db.execute(
        select(VitalsSleep).where(
            VitalsSleep.user_id == user_id,
            VitalsSleep.date == target_date,
        )
    )
    sleep = result.scalar_one_or_none()

    if sleep is None:
        sleep = VitalsSleep(user_id=user_id, date=target_date, **values)
        db.add(sleep)
    else:
        for key, value in values.items():
            if value is not None:
                setattr(sleep, key, value)

    await db.flush()


async def _sync_activities(
    db: AsyncSession, user_id: int, client, start_date: date, end_date: date
) -> None:
    """Fetch activities from Garmin and upsert VitalsActivity by garmin_activity_id."""
    start_str = start_date.isoformat()
    end_str = end_date.isoformat()

    try:
        activities = client.get_activities_by_date(start_str, end_str)
    except GarminConnectTooManyRequestsError:
        raise GarminRateLimitError("429 on get_activities_by_date")
    except Exception as e:
        logger.warning("Failed to get activities for %s to %s: %s", start_str, end_str, e)
        return

    if not activities or not isinstance(activities, list):
        return

    for act in activities:
        garmin_id = act.get("activityId")
        if not garmin_id:
            continue

        # Check if activity already exists (dedup)
        result = await db.execute(
            select(VitalsActivity).where(
                VitalsActivity.garmin_activity_id == garmin_id
            )
        )
        existing = result.scalar_one_or_none()

        # Parse start time
        start_ts = act.get("beginTimestamp")
        start_time = (
            datetime.fromtimestamp(start_ts / 1000, tz=timezone.utc)
            if start_ts
            else datetime.now(timezone.utc)
        )

        values = {
            "activity_type": act.get("activityType", {}).get("typeKey", "unknown"),
            "name": act.get("activityName"),
            "start_time": start_time,
            "duration_seconds": int(act.get("duration", 0)),
            "distance_m": act.get("distance"),
            "avg_hr": act.get("averageHR"),
            "max_hr": act.get("maxHR"),
            "calories": act.get("calories"),
            "avg_pace": _format_pace(act.get("averageSpeed"), act.get("distance")),
            "elevation_gain": act.get("elevationGain"),
            "raw_json": act,
        }

        if existing is None:
            activity = VitalsActivity(
                user_id=user_id, garmin_activity_id=garmin_id, **values
            )
            db.add(activity)
        else:
            for key, value in values.items():
                if value is not None:
                    setattr(existing, key, value)

    await db.flush()


def _format_pace(avg_speed: float | None, distance: float | None) -> str | None:
    """Convert average speed (m/s) to pace string (e.g., '5:30 /km')."""
    if not avg_speed or avg_speed <= 0:
        return None
    pace_seconds_per_km = 1000 / avg_speed
    minutes = int(pace_seconds_per_km // 60)
    seconds = int(pace_seconds_per_km % 60)
    return f"{minutes}:{seconds:02d} /km"


async def run_garmin_sync(user_id: int) -> None:
    """Background sync job for APScheduler."""
    async with async_session_factory() as db:
        try:
            await sync_user_data(db, user_id)
            await db.commit()

            # Auto-generate briefing after successful sync
            try:
                from app.services.vitals_briefing import maybe_auto_generate_briefing

                await maybe_auto_generate_briefing(db, user_id)
                await db.commit()
            except Exception as e:
                logger.warning("Post-sync briefing generation failed for user %s: %s", user_id, e)

        except Exception as e:
            # Commit error state so it persists (cooldown, sync_error, etc.)
            await db.commit()
            logger.error("Background Garmin sync failed for user %s: %s", user_id, e)
