# Phase 34: Message Collection & Filtering

## Overview

Background scheduler for periodic source polling, keyword filtering, AI relevance analysis, message storage with TTL cleanup, and deduplication. Uses APScheduler with async support for scheduling polling and cleanup jobs per user.

**Result:** System automatically polls Telegram sources, filters messages by keywords and AI relevance, stores them with TTL, and cleans up expired messages.

## Tasks

### Task 1: Install APScheduler and create scheduler module
- **Description:** Add APScheduler dependency, create async scheduler singleton with lifespan integration
- **Files:** `backend/requirements.txt` (modify), `backend/app/core/scheduler.py` (new)
- **Details:**
  - Add `apscheduler>=3.10` to requirements.txt
  - Create scheduler module with `AsyncIOScheduler` using `MemoryJobStore`
  - Lifespan integration: start scheduler on app startup, shutdown on app stop
  - Export `scheduler` instance and helper `schedule_user_polling(user_id, interval_minutes)` function
  - Helper `remove_user_polling(user_id)` to cancel a user's polling job
- **AC:** Scheduler starts/stops with the FastAPI app
- **Verify:** Import check, app starts without error

### Task 2: Integrate scheduler with FastAPI lifespan
- **Description:** Add lifespan context manager to FastAPI app for scheduler startup/shutdown
- **Files:** `backend/app/main.py` (modify)
- **Details:**
  - Create `lifespan` async context manager
  - On startup: start scheduler, schedule existing users' polling jobs from DB (load PulseSettings)
  - On shutdown: scheduler.shutdown()
  - Pass `lifespan=lifespan` to FastAPI constructor
- **AC:** Scheduler starts on app boot and restores scheduled jobs
- **Verify:** App startup logs show scheduler starting

### Task 3: Create message collection service
- **Description:** Service that polls a single source via Telethon and stores new messages
- **Files:** `backend/app/services/pulse_collector.py` (new)
- **Details:**
  - `collect_source(db, user, source)` — reads messages from source since `last_polled_at` (or last 24h on first poll)
  - Uses `get_client_for_user()` to get Telethon client
  - Iterates messages with `client.iter_messages(entity, offset_date=last_polled_at, limit=100)`
  - Deduplication: skip if `(user_id, source_id, telegram_message_id)` already exists
  - Sets `expires_at = collected_at + timedelta(days=ttl)` from PulseSettings
  - Updates `source.last_polled_at` after successful poll
  - `collect_all_sources(db, user_id)` — collect from all active sources for a user, sequentially with 2s delay between sources
- **AC:** Messages are collected, deduplicated, stored with TTL
- **Verify:** Service tests (Task 7)

### Task 4: Create keyword filter service
- **Description:** Fast keyword-based filter that checks if a message matches source keywords
- **Files:** `backend/app/services/pulse_filter.py` (new)
- **Details:**
  - `keyword_filter(message_text, keywords)` — returns True if any keyword found in message text (case-insensitive)
  - If source has no keywords (empty or null), all messages pass the filter
  - Filter is applied during collection — messages that don't pass are not stored
- **AC:** Messages matching keywords are kept, non-matching are discarded (unless no keywords set)
- **Verify:** Unit tests (Task 7)

### Task 5: Create AI relevance filter service
- **Description:** AI-based relevance scoring for messages that pass keyword filter
- **Files:** `backend/app/services/pulse_ai_filter.py` (new)
- **Details:**
  - `analyze_relevance(message_text, source_category, criteria, llm_client)` — returns `(relevance_score: float, classification: str | None)`
  - For "jobs" category: check against criteria (grade, stack, salary, location) — return relevance 0.0-1.0
  - For "learning" category: classify as article/lifehack/insight/tool/other — return classification + relevance
  - For "news" category: return relevance 1.0 (all news passes)
  - Uses existing `get_llm_client()` from `app.services.ai`
  - Graceful fallback: if AI call fails, set relevance to 0.5 (neutral) and log warning
- **AC:** Messages get relevance scores and classifications based on category
- **Verify:** Service tests with mocked LLM (Task 7)

### Task 6: Create polling orchestrator and TTL cleanup
- **Description:** Scheduled job that orchestrates polling for a user + TTL cleanup job
- **Files:** `backend/app/services/pulse_scheduler.py` (new)
- **Details:**
  - `run_user_poll(user_id)` — async job called by APScheduler:
    1. Get user's active sources
    2. For each source: collect messages, apply keyword filter
    3. For messages that pass keyword filter: apply AI filter (batch to reduce API calls)
    4. Store filtered messages with relevance scores
    5. Log summary: N sources polled, M messages collected, K after filtering
  - `run_ttl_cleanup()` — periodic job (runs daily):
    1. Delete all pulse_messages where `expires_at < now()`
    2. Log count of cleaned messages
  - Schedule cleanup on scheduler start (once daily at 03:00)
- **AC:** Polling runs on schedule, cleanup removes expired messages
- **Verify:** Service tests (Task 7)

### Task 7: Backend tests for collection and filtering
- **Description:** Tests for collector, filters, and scheduler services
- **Files:** `backend/tests/test_pulse_collection.py` (new)
- **Tests:**
  - `test_keyword_filter_match` — keyword found in text
  - `test_keyword_filter_no_match` — keyword not found
  - `test_keyword_filter_empty_keywords` — all messages pass when no keywords
  - `test_collect_source_deduplication` — existing messages skipped
  - `test_collect_source_stores_new_messages` — new messages stored
  - `test_ai_relevance_jobs_category` — mocked LLM returns relevance for jobs
  - `test_ai_relevance_news_category` — news always gets 1.0
  - `test_ai_relevance_fallback_on_error` — returns 0.5 on failure
  - `test_ttl_cleanup` — expired messages deleted
  - `test_run_user_poll_orchestration` — full poll flow mocked
- **AC:** All 10 tests pass
- **Verify:** `pytest tests/test_pulse_collection.py -v`

### Task 8: Create polling trigger API endpoint
- **Description:** Manual trigger endpoint to poll sources on demand
- **Files:** `backend/app/api/pulse_sources.py` (modify)
- **Details:**
  - `POST /api/pulse/sources/poll` — trigger immediate polling for current user
  - Returns `{"ok": true, "detail": "Polling started", "sources_count": N}`
  - Runs polling as background task (FastAPI BackgroundTasks)
  - Rate limit: prevent re-triggering if last poll was < 5 minutes ago
- **AC:** Manual poll trigger works, respects rate limit
- **Verify:** API test (Task 7)

### Task 9: Create Pulse Settings API endpoints
- **Description:** CRUD for user's Pulse settings (polling interval, TTL, etc.)
- **Files:** `backend/app/api/pulse_settings.py` (new), `backend/app/schemas/pulse_settings.py` (new), `backend/app/services/pulse_settings.py` (new)
- **Details:**
  - `GET /api/pulse/settings/` — get user's pulse settings (create default if not exists)
  - `PUT /api/pulse/settings/` — update settings
  - Schema: `PulseSettingsResponse` and `PulseSettingsUpdate` matching PulseSettings model
  - On update of `polling_interval_minutes`: reschedule user's polling job
  - Register router in main.py
- **AC:** Settings CRUD works, changing interval reschedules polling
- **Verify:** Backend tests

### Task 10: Backend tests for settings and poll trigger
- **Description:** Tests for Pulse settings API and poll trigger
- **Files:** `backend/tests/test_pulse_settings.py` (new)
- **Tests:**
  - `test_get_settings_creates_default` — returns default settings for new user
  - `test_update_settings` — updates fields correctly
  - `test_settings_schema` — validates schema serialization
  - `test_poll_trigger_endpoint` — POST returns ok
  - `test_poll_trigger_rate_limit` — rejects if polled recently
- **AC:** All 5 tests pass
- **Verify:** `pytest tests/test_pulse_settings.py -v`

### Task 11: Add Pulse Settings tab to frontend Settings page
- **Description:** New tab in Settings for Pulse configuration
- **Files:** `frontend/src/components/settings/pulse-settings-tab.tsx` (new), `frontend/src/hooks/use-pulse-settings.ts` (new), `frontend/src/types/pulse-settings.ts` (new)
- **Details:**
  - Types: `PulseSettings`, `PulseSettingsUpdate`
  - Hooks: `usePulseSettings()`, `useUpdatePulseSettings()`
  - UI: Form with fields for polling_interval_minutes, message_ttl_days, digest_schedule, digest_time
  - "Poll Now" button that calls POST /api/pulse/sources/poll
  - Add tab to Settings page tabs
- **AC:** Settings tab renders, saves settings, Poll Now works
- **Verify:** Visual check + frontend build

### Task 12: Frontend tests for Pulse Settings
- **Description:** Component test for Pulse Settings tab
- **Files:** `frontend/__tests__/pulse-settings.test.tsx` (new)
- **Tests:**
  - `renders pulse settings form`
  - `updates polling interval`
  - `shows poll now button`
- **AC:** All 3 tests pass
- **Verify:** `npx vitest run __tests__/pulse-settings.test.tsx`

## Dependencies

```
Task 1 (scheduler module — independent)
Task 1 → Task 2 (scheduler → lifespan integration)
Task 3 (collector — independent, uses existing Telethon)
Task 4 (keyword filter — independent)
Task 5 (AI filter — independent, uses existing AI service)
Task 3 + Task 4 + Task 5 → Task 6 (services → orchestrator)
Task 6 → Task 7 (orchestrator → tests)
Task 6 → Task 8 (orchestrator → poll trigger API)
Task 9 (settings API — independent from polling)
Task 8 + Task 9 → Task 10 (APIs → tests)
Task 9 → Task 11 (settings API → frontend)
Task 11 → Task 12 (frontend → tests)
```

## Execution Order

1. Task 1 — Scheduler module
2. Task 2 — Lifespan integration
3. Task 4 — Keyword filter
4. Task 5 — AI relevance filter
5. Task 3 — Message collector
6. Task 6 — Polling orchestrator + TTL cleanup
7. Task 7 — Collection tests
8. Task 8 — Poll trigger API
9. Task 9 — Pulse Settings API
10. Task 10 — Settings tests
11. Task 11 — Frontend Pulse Settings tab
12. Task 12 — Frontend tests
