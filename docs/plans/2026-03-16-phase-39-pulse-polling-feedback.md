# Phase 39: Pulse Polling Feedback

**PRD:** `docs/prd-pulse-polling-feedback.md`
**Date:** 2026-03-16
**Scope:** Add polling status tracking and completion feedback to Pulse sources

## Tasks

### Task 1: DB migration — add poll status fields to pulse_sources
**Description:** Add `poll_status` (VARCHAR, default 'idle'), `last_poll_error` (TEXT, nullable), `last_poll_message_count` (INTEGER, default 0) columns to `pulse_sources` table.
**Files:**
- `backend/alembic/versions/XXX_add_poll_status_fields.py` (new)
- `backend/app/models/telegram.py`
**Acceptance Criteria:**
- Migration runs without errors
- New columns exist with correct types and defaults
- Existing rows get default values
**Verification:** `alembic upgrade head` succeeds, query confirms columns exist

### Task 2: Update PulseSource model and schemas
**Description:** Add new fields to SQLAlchemy model and Pydantic response schema. Expose `poll_status`, `last_poll_error`, `last_poll_message_count` in API responses.
**Files:**
- `backend/app/models/telegram.py`
- `backend/app/schemas/pulse_source.py`
**Depends on:** Task 1
**Acceptance Criteria:**
- PulseSource model has 3 new fields
- GET /api/pulse/sources/ returns new fields in response
**Verification:** Existing source tests still pass, new fields visible in API response

### Task 3: Update pulse_collector to track poll status
**Description:** Modify `collect_source()` and `collect_all_sources()` to set `poll_status = 'polling'` before collection, `poll_status = 'idle'` + `last_poll_message_count` on success, `poll_status = 'error'` + `last_poll_error` on failure.
**Files:**
- `backend/app/services/pulse_collector.py`
**Depends on:** Task 2
**Acceptance Criteria:**
- Source status set to `polling` before collection starts
- Source status set to `idle` with message count on success
- Source status set to `error` with error message on failure
- `last_poll_message_count` reflects new messages found in this poll
**Verification:** Unit tests for collector with mocked Telegram client

### Task 4: New poll-status API endpoint
**Description:** Add `GET /api/pulse/sources/poll-status` returning current poll status for all active sources. Lightweight query — no joins, minimal fields.
**Files:**
- `backend/app/api/pulse_sources.py`
- `backend/app/schemas/pulse_source.py` (add PollStatusResponse schema)
**Depends on:** Task 2
**Acceptance Criteria:**
- Endpoint returns `{sources: [...], any_polling: bool}`
- Each source includes: id, title, poll_status, last_poll_error, last_poll_message_count, last_polled_at
- Response time < 50ms
**Verification:** API test for endpoint, check response schema

### Task 5: Update frontend PulseSource type
**Description:** Add `poll_status`, `last_poll_error`, `last_poll_message_count` to frontend TypeScript types.
**Files:**
- `frontend/src/types/pulse-source.ts`
**Depends on:** Task 4
**Acceptance Criteria:**
- PulseSource type includes new fields
- No type errors in existing code
**Verification:** `npm run build` passes

### Task 6: Frontend poll-status hook with auto-polling
**Description:** Create `usePollStatus()` hook that fetches `/poll-status` every 2s while `any_polling === true`. Auto-starts on manual poll trigger, stops when all sources idle/error. Safety timeout at 5 minutes.
**Files:**
- `frontend/src/hooks/use-pulse-sources.ts`
**Depends on:** Task 5
**Acceptance Criteria:**
- Hook starts polling after `useTriggerPoll` succeeds
- Hook polls every 2s while `any_polling` is true
- Hook stops when all sources idle/error
- Hook stops after 5 min max (safety)
**Verification:** Frontend test for hook behavior

### Task 7: Update useTriggerPoll to activate status polling
**Description:** Modify `useTriggerPoll` hook to start poll-status polling on success and show completion/error toasts when polling finishes. Invalidate sources, inbox, and digest queries on completion.
**Files:**
- `frontend/src/hooks/use-pulse-settings.ts`
- `frontend/src/hooks/use-pulse-sources.ts`
**Depends on:** Task 6
**Acceptance Criteria:**
- "Poll Now" starts status polling
- Toast on completion: "Poll complete: X new messages"
- Toast on error: "Poll failed for <source>: <error>"
- Sources list, inbox, digest auto-refresh after completion
**Verification:** Manual test + frontend unit test

### Task 8: Inline polling indicator on Sources list
**Description:** Show spinner + "Polling..." badge next to each source that has `poll_status === 'polling'`. Show last poll result: "Last poll: X ago · Y new messages" or error state.
**Files:**
- `frontend/src/components/pulse/sources-list.tsx`
**Depends on:** Task 7
**Acceptance Criteria:**
- Spinning indicator visible while source is polling
- Last poll result shown (time ago + message count)
- Error state displayed if last poll failed
**Verification:** Visual check + snapshot test

### Task 9: Backend tests for poll status tracking
**Description:** Tests for poll status lifecycle: idle → polling → idle/error, message count tracking, poll-status endpoint.
**Files:**
- `backend/tests/test_pulse_poll_status.py` (new)
**Depends on:** Tasks 3, 4
**Acceptance Criteria:**
- Test poll status transitions
- Test poll-status endpoint response
- Test error handling sets correct status
**Verification:** `pytest` passes

### Task 10: Frontend tests for polling feedback
**Description:** Tests for usePollStatus hook, useTriggerPoll integration, and sources list polling indicators.
**Files:**
- `frontend/src/__tests__/pulse-poll-status.test.tsx` (new)
**Depends on:** Tasks 7, 8
**Acceptance Criteria:**
- Test hook starts/stops polling correctly
- Test toast messages on completion/error
- Test inline indicator rendering
**Verification:** `npm test` passes

## Execution Order
1. Task 1 (migration)
2. Task 2 (model + schema)
3. Tasks 3, 4 (parallel — collector + endpoint)
4. Task 5 (frontend types)
5. Task 6 (poll-status hook)
6. Task 7 (trigger integration)
7. Task 8 (UI indicators)
8. Tasks 9, 10 (parallel — backend + frontend tests)
