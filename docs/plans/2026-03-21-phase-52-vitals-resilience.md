# Phase 52 — Vitals Resilience & Demo Fix

**Date:** 2026-03-21
**Status:** Planning
**Depends on:** Phase 44–48 (Vitals core, merged)

## Overview

Upgrade Garmin sync resilience with exponential backoff circuit breaker, add sync_log observability table, show stale-data warnings on the frontend, and fix the demo reset endpoint that silently drops vitals data.

---

## Task 1: Add `consecutive_failures` column to GarminConnection

**Description:** Add a new integer column `consecutive_failures` (default 0) to the `garmin_connections` table. This counter drives the exponential backoff calculation.

**Files:**
- `backend/app/models/garmin.py` — add column
- `backend/alembic/versions/` — new migration

**Acceptance criteria:**
- Column exists with default 0, nullable=False
- Migration runs cleanly up and down

**Verification:** `alembic upgrade head` succeeds, column visible in DB schema

---

## Task 2: Implement exponential backoff in sync service

**Description:** Replace the fixed 1-hour cooldown with progressive backoff: 15m → 30m → 60m → 120m (capped). On success — reset counter to 0. On 429 or auth error — increment counter, calculate `cooldown = min(15 * 2^failures, 120)` minutes.

**Files:**
- `backend/app/services/garmin_auth.py` — update `set_rate_limited()` to accept and use consecutive_failures
- `backend/app/services/garmin_sync.py` — increment `consecutive_failures` on failure, reset on success

**Acceptance criteria:**
- 1st failure → 15min cooldown
- 2nd failure → 30min cooldown
- 3rd failure → 60min cooldown
- 4th+ failure → 120min cooldown (cap)
- Successful sync → counter resets to 0, rate_limited_until cleared
- Connect flow also respects the backoff

**Verification:** Unit tests with mocked failures verify escalating cooldowns

---

## Task 3: Create `sync_log` table and model

**Description:** New table `vitals_sync_log` to record every sync attempt with: user_id, started_at, finished_at, status (success/error/rate_limited), error_message, records_synced (metrics/sleep/activities counts), duration_ms.

**Files:**
- `backend/app/models/garmin.py` — add `VitalsSyncLog` model
- `backend/app/models/__init__.py` — register model
- `backend/alembic/versions/` — new migration

**Acceptance criteria:**
- Table created with all columns
- Index on (user_id, started_at)
- Migration runs cleanly

**Verification:** `alembic upgrade head` succeeds

---

## Task 4: Log sync attempts to sync_log

**Description:** Instrument `sync_user_data()` to create a `VitalsSyncLog` entry at the start of each sync and update it on completion/failure. Track counts of upserted records.

**Files:**
- `backend/app/services/garmin_sync.py` — add logging to sync_user_data and _sync_* helpers (return counts)

**Acceptance criteria:**
- Every sync attempt (success or failure) creates a log entry
- Log includes duration, record counts, error message if failed
- Rate-limited skips also logged (status = "rate_limited")

**Verification:** Unit tests verify log entries created for success, error, and rate-limited scenarios

---

## Task 5: Add sync log API endpoint

**Description:** New GET endpoint `/api/vitals/sync-log` returning recent sync log entries for the current user. Useful for debugging and for the frontend to detect stale data.

**Files:**
- `backend/app/api/garmin.py` — add endpoint
- `backend/app/schemas/garmin.py` — add response schema

**Acceptance criteria:**
- Returns last 20 entries by default, supports `limit` param
- Ordered by started_at descending
- Includes all fields from the model

**Verification:** Unit test with seeded log entries

---

## Task 6: Stale data banner on Vitals page

**Description:** When the last successful sync was more than 2x the sync interval ago, show a warning banner: "Data may be outdated — last synced X hours ago. Sync is temporarily unavailable." Uses existing `connection.last_sync_at` and `connection.sync_interval_minutes`.

**Files:**
- `frontend/src/app/(dashboard)/vitals/page.tsx` — add stale detection + banner component

**Acceptance criteria:**
- Banner appears when `now - last_sync_at > 2 * sync_interval_minutes`
- Banner shows human-readable time since last sync
- Banner has warning styling (amber/yellow)
- No banner when sync is fresh or when in demo mode
- Banner hidden when no connection

**Verification:** Frontend test with mocked stale connection data

---

## Task 7: Stale data indicator on Vitals dashboard widget

**Description:** Lighter version of the stale banner for the dashboard widget — a small amber dot or text line indicating data staleness.

**Files:**
- `frontend/src/components/dashboard/vitals-widget.tsx` — add stale indicator
- `frontend/src/hooks/use-vitals.ts` — extend `useVitalsDashboardSummary` response type if needed

**Acceptance criteria:**
- Small warning indicator when data is stale (same 2x interval logic)
- Does not break existing widget layout
- Not shown in demo mode

**Verification:** Frontend test

---

## Task 8: Fix demo reset — add vitals data seeding

**Description:** Add `create_vitals_data(db, user.id)` call to the demo reset endpoint so vitals data is restored along with all other modules.

**Files:**
- `backend/app/api/users.py` — add import and call

**Acceptance criteria:**
- After demo reset, vitals data exists (30 days metrics, 30 days sleep, 15 activities, 1 briefing)
- Existing demo seeder function `create_vitals_data` is reused as-is

**Verification:** Backend test: POST /api/users/demo/reset → GET /api/vitals/today returns data

---

## Task 9: Backend tests for circuit breaker and sync log

**Description:** Comprehensive tests for the new exponential backoff logic, sync_log creation, and the sync log endpoint.

**Files:**
- `backend/tests/test_garmin_sync.py` — extend with circuit breaker + sync_log tests
- `backend/tests/test_garmin_auth.py` — extend with backoff tests

**Acceptance criteria:**
- Test escalating cooldowns (1st, 2nd, 3rd, 4th failure)
- Test cooldown cap at 120min
- Test reset on success
- Test sync_log entries created on success/error/rate_limited
- Test GET /api/vitals/sync-log endpoint

**Verification:** `pytest` passes

---

## Task 10: Frontend tests for stale data indicators

**Description:** Tests for the stale banner on the Vitals page and the stale indicator on the dashboard widget.

**Files:**
- `frontend/__tests__/vitals.test.tsx` — extend with stale banner tests
- `frontend/__tests__/vitals-widget.test.tsx` — extend with stale indicator tests

**Acceptance criteria:**
- Test: banner shown when last_sync_at is stale
- Test: banner hidden when sync is fresh
- Test: banner hidden in demo mode
- Test: widget indicator shown/hidden correctly

**Verification:** `npm test` passes

---

## Execution Order

```
Task 1 (DB column) → Task 2 (backoff logic) → Task 9 (backend tests)
Task 3 (sync_log table) → Task 4 (log writes) → Task 5 (log endpoint) → Task 9
Task 6 (stale banner) → Task 10 (frontend tests)
Task 7 (widget indicator) → Task 10
Task 8 (demo fix) — independent, can run in parallel
```

## Dependencies

- Tasks 1–2 are sequential (column first, then logic)
- Tasks 3–5 are sequential (table → writes → API)
- Tasks 6–7 can run in parallel after backend is done
- Task 8 is fully independent
- Tasks 9–10 are test tasks, run after their respective implementation tasks
