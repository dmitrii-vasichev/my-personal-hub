"""One-shot backfill: apply the D13 auto-hint rule to calendar events
whose ``job_id`` is currently NULL.

Scope is always ``WHERE job_id IS NULL`` so re-running is a no-op —
subsequent passes cannot double-match an already-linked event or mutate
an existing link. Ambiguous events (≥2 company-name matches) and
no-match events are reported in the summary but left NULL so the user
can resolve them manually in the event-edit dialog.

Usage
-----

Run from ``backend/``::

    PYTHONPATH=. python -m scripts.backfill_job_event_links

Output: a single JSON document on stdout::

    {"users": N, "scanned": N, "matched": M, "ambiguous": A, "no_match": K}

Exit codes: 0 on success. Any exception propagates a non-zero exit
with a traceback on stderr — intentional, since a data-operation
script that half-succeeds silently is worse than one that blows up
loudly.
"""
from __future__ import annotations

import asyncio
import json

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.config import settings as app_settings
from app.models.calendar import CalendarEvent
from app.models.user import User
from app.services.calendar import _find_hint_candidates


async def run_backfill(session_factory) -> dict:
    """Core loop, parametrised on a session factory so tests can inject
    an in-memory / test-scoped factory instead of the real engine.
    Returns the summary dict; the CLI entry point adds the stdout print.
    """
    totals = {
        "users": 0,
        "scanned": 0,
        "matched": 0,
        "ambiguous": 0,
        "no_match": 0,
    }
    async with session_factory() as db:
        users = list((await db.execute(select(User))).scalars().all())
        totals["users"] = len(users)
        for user in users:
            events_q = await db.execute(
                select(CalendarEvent).where(
                    CalendarEvent.user_id == user.id,
                    CalendarEvent.job_id.is_(None),
                )
            )
            events = list(events_q.scalars().all())
            for event in events:
                totals["scanned"] += 1
                candidates = await _find_hint_candidates(db, event, user)
                if len(candidates) == 1:
                    event.job_id = candidates[0].id
                    totals["matched"] += 1
                elif len(candidates) >= 2:
                    totals["ambiguous"] += 1
                else:
                    totals["no_match"] += 1
            await db.commit()
    return totals


async def main() -> None:
    engine = create_async_engine(app_settings.DATABASE_URL)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    try:
        totals = await run_backfill(session_factory)
    finally:
        await engine.dispose()
    print(json.dumps(totals))


if __name__ == "__main__":
    asyncio.run(main())
