# Phase 45: Vitals Backend — Sync & Metrics Collection

## Overview
Garmin sync service for fetching daily metrics, sleep, and activities from the garminconnect API. APScheduler integration for periodic sync jobs, manual sync trigger, API endpoints for querying data, and a dashboard vitals-summary endpoint.

## Tasks

### Task 1: Create Garmin sync service
Create `backend/app/services/garmin_sync.py`:
- `sync_user_data(db, user_id)` — main sync function:
  1. Load GarminConnection, set `sync_status="syncing"`
  2. Get authenticated client via `garmin_auth.get_garmin_client()`
  3. Fetch today + yesterday data (to catch late-arriving sleep data)
  4. Call `_sync_daily_metrics()`, `_sync_sleep()`, `_sync_activities()`
  5. Update `last_sync_at=now`, `sync_status="success"`
  6. On error: set `sync_status="error"`, `sync_error=str(e)`, log
- `_sync_daily_metrics(db, user_id, client, date)`:
  - Call `client.get_user_summary(date)` and `client.get_body_battery(date, date)` and `client.get_max_metrics(date)`
  - Upsert VitalsDailyMetric by (user_id, date)
  - Map API fields to model fields, store full response in `raw_json`
- `_sync_sleep(db, user_id, client, date)`:
  - Call `client.get_sleep_data(date)`
  - Upsert VitalsSleep by (user_id, date)
  - Parse duration, deep/light/REM/awake seconds, sleep score
- `_sync_activities(db, user_id, client, start_date, end_date)`:
  - Call `client.get_activities_by_date(start, end)`
  - For each activity: upsert VitalsActivity by `garmin_activity_id` (dedup)
  - First sync: last 7 days; subsequent: last 2 days

### Task 2: Create APScheduler integration for Garmin sync
Extend `backend/app/core/scheduler.py`:
- `schedule_garmin_sync(user_id, interval_minutes)`:
  - Job ID: `garmin_sync_{user_id}`
  - Interval job calling `run_garmin_sync(user_id)`
  - Replace existing job if present (for interval changes)
  - Misfire grace time: 300s
- `remove_garmin_sync(user_id)`:
  - Remove job `garmin_sync_{user_id}` if exists

### Task 3: Create async background sync job
Add to `backend/app/services/garmin_sync.py`:
- `async run_garmin_sync(user_id)`:
  - Create fresh session via `async_session_factory()`
  - Call `sync_user_data(db, user_id)`
  - Catch all exceptions, log errors
  - Same pattern as `run_user_poll` in pulse_scheduler.py

### Task 4: Integrate scheduler in app lifecycle
Modify `backend/app/main.py` lifespan:
- On startup: query all `GarminConnection` where `is_active=True`
- For each: call `schedule_garmin_sync(conn.user_id, conn.sync_interval_minutes)`

### Task 5: Update connect/disconnect to manage sync jobs
Modify `backend/app/services/garmin_auth.py`:
- `connect()`: after successful login → call `schedule_garmin_sync()` + trigger immediate `sync_user_data()`
- `disconnect()`: call `remove_garmin_sync()` before deleting connection
- `update_sync_interval()`: call `schedule_garmin_sync()` with new interval (reschedule)

### Task 6: Add data query API endpoints
Extend `backend/app/api/garmin.py`:
- `POST /api/vitals/sync` — manual sync trigger
- `GET /api/vitals/metrics?start_date=&end_date=` — daily metrics by date range
- `GET /api/vitals/sleep?start_date=&end_date=` — sleep data by date range
- `GET /api/vitals/activities?start_date=&end_date=&limit=20&offset=0` — activities with pagination
- `GET /api/vitals/today` — today's snapshot

### Task 7: Add dashboard vitals-summary endpoint
- `GET /api/dashboard/vitals-summary` — compact widget data

### Task 8: Add date query schemas
Extend `backend/app/schemas/garmin.py`:
- `VitalsDateRangeQuery`, `VitalsActivitiesQuery`, `VitalsDashboardSummaryResponse`

### Task 9: Tests for sync service and API endpoints
Create `backend/tests/test_garmin_sync.py`

## Files to Create
- `backend/app/services/garmin_sync.py`
- `backend/tests/test_garmin_sync.py`

## Files to Modify
- `backend/app/core/scheduler.py`
- `backend/app/main.py`
- `backend/app/services/garmin_auth.py`
- `backend/app/api/garmin.py`
- `backend/app/schemas/garmin.py`
