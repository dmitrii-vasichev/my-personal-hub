"""One-shot backfill: fill training-readiness columns on
``vitals_daily_metrics`` for the last N days.

Tasks 1-9 of the Training Readiness rollout added four columns
(``training_readiness``, ``_level``, ``_recovery_hours``, ``_feedback``)
and the live sync now populates them. This script is for historical
days that were synced before the columns existed — it walks back N days,
fetches the morning-training-readiness payload from Garmin per day, and
updates the existing ``vitals_daily_metrics`` row in place.

It deliberately does NOT create new rows: if there is no metrics row
for a date, the date is skipped (logged as ``skipped_missing_row``).
The intent is "backfill what we have", not "re-run a full sync".

Usage
-----

Run from ``backend/``::

    PYTHONPATH=. python -m scripts.backfill_training_readiness \\
        --user-id 1 --days 90 [--dry-run]

Exit codes: 0 on success. Any uncaught exception propagates a non-zero
exit code with a traceback on stderr.
"""
from __future__ import annotations

import argparse
import asyncio
import logging
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.config import settings as app_settings
from app.models.garmin import VitalsDailyMetric
from app.services.garmin_auth import get_garmin_client
from app.services.garmin_sync import _extract_training_readiness


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
log = logging.getLogger("backfill_training_readiness")


async def run_backfill(
    session_factory,
    user_id: int,
    days: int,
    dry_run: bool,
) -> dict:
    """Core loop, parametrised on a session factory so the CLI entry
    point and any future smoke test can share it.

    Returns a summary dict with counters.
    """
    totals = {
        "updated": 0,
        "skipped_no_data": 0,
        "skipped_missing_row": 0,
    }
    today = date.today()
    async with session_factory() as db:
        client = await get_garmin_client(db, user_id)
        if client is None:
            log.error("No active Garmin connection for user %s", user_id)
            return totals

        for offset in range(days):
            d = today - timedelta(days=offset)
            try:
                payload = client.get_morning_training_readiness(d.isoformat())
            except Exception as e:  # noqa: BLE001
                log.warning("Garmin error for %s: %s", d, e)
                continue

            score, level, recovery, feedback = _extract_training_readiness(payload)
            if score is None:
                totals["skipped_no_data"] += 1
                continue

            row = (
                await db.execute(
                    select(VitalsDailyMetric).where(
                        VitalsDailyMetric.user_id == user_id,
                        VitalsDailyMetric.date == d,
                    )
                )
            ).scalar_one_or_none()

            if row is None:
                totals["skipped_missing_row"] += 1
                log.info("No metrics row for %s; skipping", d)
                continue

            log.info(
                "%s readiness=%s level=%s recovery=%s",
                d, score, level, recovery,
            )
            if dry_run:
                continue

            row.training_readiness = score
            row.training_readiness_level = level
            row.training_readiness_recovery_hours = recovery
            row.training_readiness_feedback = feedback
            raw = dict(row.raw_json or {})
            raw["training_readiness"] = payload
            row.raw_json = raw
            totals["updated"] += 1

        if not dry_run:
            await db.commit()

    log.info(
        "Done. updated=%d skipped_no_data=%d skipped_missing_row=%d",
        totals["updated"],
        totals["skipped_no_data"],
        totals["skipped_missing_row"],
    )
    return totals


async def main(user_id: int, days: int, dry_run: bool) -> None:
    engine = create_async_engine(app_settings.DATABASE_URL)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    try:
        await run_backfill(session_factory, user_id, days, dry_run)
    finally:
        await engine.dispose()


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--user-id", type=int, required=True)
    p.add_argument("--days", type=int, default=90)
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()
    asyncio.run(main(args.user_id, args.days, args.dry_run))
