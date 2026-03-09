"""
Google Calendar sync service.

Bidirectional sync:
- Pull: fetch events from Google Calendar API → upsert into calendar_events
- Push: local events (source='local', no google_event_id) → create on Google → save google_event_id
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from googleapiclient.discovery import build
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.calendar import CalendarEvent, EventSource, GoogleOAuthToken
from app.models.user import User
from app.services.google_oauth import get_credentials


def _parse_google_datetime(dt_str: Optional[str], date_str: Optional[str]) -> tuple[datetime, bool]:
    """Parse Google event start/end. Returns (datetime, is_all_day)."""
    if date_str:
        # All-day event: date format "YYYY-MM-DD"
        from datetime import date
        d = date.fromisoformat(date_str)
        return datetime(d.year, d.month, d.day, tzinfo=timezone.utc), True
    if dt_str:
        dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
        return dt.astimezone(timezone.utc), False
    return datetime.now(timezone.utc), False


async def sync_calendar(db: AsyncSession, user: User) -> dict:
    """
    Full bidirectional sync. Returns summary of changes.
    Gracefully handles missing credentials (returns no-op result).
    """
    creds = await get_credentials(db, user)
    if not creds:
        return {"pulled": 0, "pushed": 0, "error": "Not connected to Google Calendar"}

    try:
        service = build("calendar", "v3", credentials=creds, cache_discovery=False)
    except Exception as e:
        return {"pulled": 0, "pushed": 0, "error": str(e)}

    # Get user's calendar_id preference
    result = await db.execute(
        select(GoogleOAuthToken).where(GoogleOAuthToken.user_id == user.id)
    )
    token_record = result.scalar_one_or_none()
    calendar_id = token_record.calendar_id if token_record else "primary"

    pulled = await _pull_events(db, user, service, calendar_id)
    pushed = await _push_events(db, user, service, calendar_id)

    # Update last synced timestamp
    if token_record:
        token_record.updated_at = datetime.now(timezone.utc)
        await db.commit()

    return {"pulled": pulled, "pushed": pushed, "error": None}


async def _pull_events(db: AsyncSession, user: User, service, calendar_id: str) -> int:
    """Fetch events from Google Calendar and upsert locally."""
    # Fetch events from last 3 months to next 6 months
    from datetime import timedelta
    now = datetime.now(timezone.utc)
    time_min = (now - timedelta(days=90)).isoformat()
    time_max = (now + timedelta(days=180)).isoformat()

    try:
        events_result = (
            service.events()
            .list(
                calendarId=calendar_id,
                timeMin=time_min,
                timeMax=time_max,
                singleEvents=True,
                orderBy="startTime",
                maxResults=500,
            )
            .execute()
        )
    except Exception:
        return 0

    google_events = events_result.get("items", [])
    pulled_count = 0

    for g_event in google_events:
        if g_event.get("status") == "cancelled":
            # Delete local copy if exists
            local = await _find_by_google_id(db, user.id, g_event["id"])
            if local:
                await db.delete(local)
            continue

        start_dt, is_all_day = _parse_google_datetime(
            g_event.get("start", {}).get("dateTime"),
            g_event.get("start", {}).get("date"),
        )
        end_dt, _ = _parse_google_datetime(
            g_event.get("end", {}).get("dateTime"),
            g_event.get("end", {}).get("date"),
        )

        local = await _find_by_google_id(db, user.id, g_event["id"])
        if local:
            # Update existing
            local.title = g_event.get("summary", "(No title)")
            local.description = g_event.get("description")
            local.start_time = start_dt
            local.end_time = end_dt
            local.location = g_event.get("location")
            local.all_day = is_all_day
            local.synced_at = datetime.now(timezone.utc)
        else:
            # Create new
            local = CalendarEvent(
                user_id=user.id,
                google_event_id=g_event["id"],
                title=g_event.get("summary", "(No title)"),
                description=g_event.get("description"),
                start_time=start_dt,
                end_time=end_dt,
                location=g_event.get("location"),
                all_day=is_all_day,
                source=EventSource.google,
                synced_at=datetime.now(timezone.utc),
            )
            db.add(local)
            pulled_count += 1

    await db.commit()
    return pulled_count


async def _push_events(db: AsyncSession, user: User, service, calendar_id: str) -> int:
    """Push local events (source='local', no google_event_id) to Google Calendar."""
    result = await db.execute(
        select(CalendarEvent).where(
            CalendarEvent.user_id == user.id,
            CalendarEvent.source == EventSource.local,
            CalendarEvent.google_event_id.is_(None),
        )
    )
    local_events = list(result.scalars().all())
    pushed_count = 0

    for event in local_events:
        g_event_body = {
            "summary": event.title,
            "description": event.description,
            "location": event.location,
        }
        if event.all_day:
            g_event_body["start"] = {"date": event.start_time.date().isoformat()}
            g_event_body["end"] = {"date": event.end_time.date().isoformat()}
        else:
            g_event_body["start"] = {"dateTime": event.start_time.isoformat()}
            g_event_body["end"] = {"dateTime": event.end_time.isoformat()}

        try:
            created = service.events().insert(calendarId=calendar_id, body=g_event_body).execute()
            event.google_event_id = created["id"]
            event.synced_at = datetime.now(timezone.utc)
            pushed_count += 1
        except Exception:
            continue  # Skip failed pushes, retry next sync

    await db.commit()
    return pushed_count


async def _find_by_google_id(
    db: AsyncSession,
    user_id: int,
    google_event_id: str,
) -> Optional[CalendarEvent]:
    result = await db.execute(
        select(CalendarEvent).where(
            CalendarEvent.user_id == user_id,
            CalendarEvent.google_event_id == google_event_id,
        )
    )
    return result.scalar_one_or_none()
