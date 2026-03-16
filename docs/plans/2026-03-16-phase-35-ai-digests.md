# Phase 35: AI Digests

**Date:** 2026-03-16
**PRD:** docs/prd-telegram-pulse.md
**Covers:** FR-14, FR-15, FR-16, FR-17, FR-18
**Dependencies:** Phase 34 (Message Collection & Filtering) — merged

## Overview

Build the digest generation pipeline: an AI service that reads collected messages grouped by category/subcategory, generates structured markdown summaries via the user's LLM provider, stores them in `pulse_digests`, and exposes them through API + frontend UI. Includes scheduled generation (APScheduler cron) and on-demand "Generate now" button.

## Prerequisites (already in place)

- `PulseDigest` model with fields: id, user_id, category, content, message_count, generated_at, period_start, period_end
- `PulseSettings` model with digest_schedule, digest_time, digest_day, digest_interval_days
- `PulseMessage` model with status field ("new" → "in_digest")
- AI service (`ai.py`) with multi-provider `generate()` interface
- APScheduler running with polling + TTL cleanup jobs
- Settings API with digest configuration fields

---

## Tasks

### Task 1: Digest generation service — core logic

**Description:** Create `backend/app/services/pulse_digest.py` with the main digest generation function. Query messages with status "new" grouped by category → subcategory → source, build prompts, call LLM, store result in `pulse_digests`, mark messages as "in_digest".

**Files:**
- `backend/app/services/pulse_digest.py` (new)

**Acceptance Criteria:**
- `generate_digest(db, user, category=None)` generates a digest for all categories or a specific one
- Messages are grouped by category → subcategory → source title
- LLM prompt includes all message texts with structure context
- Generated markdown is stored in `pulse_digests` with correct period_start/period_end
- Processed messages get status "in_digest"
- Returns the created PulseDigest object
- Gracefully handles: no messages (returns None), LLM errors (raises descriptive exception)

**Verification:** Unit tests with mocked LLM

---

### Task 2: Digest prompt templates

**Description:** Create structured prompt templates for each category type (news, jobs, learning, custom). Each produces well-formatted markdown grouped by subcategory.

**Files:**
- `backend/app/services/pulse_digest.py` (extend with prompt builder)

**Acceptance Criteria:**
- News: summarize by subcategory, highlight key events
- Jobs: list vacancies with company, title, key details, relevance score
- Learning: group by classification (article/lifehack/insight/tool), brief description per item
- Custom categories: treated same as news
- All outputs are valid markdown with headers (## category, ### subcategory)

**Verification:** Unit tests verifying prompt structure for each category

---

### Task 3: Pydantic schemas for digest API

**Description:** Create request/response schemas for digest endpoints.

**Files:**
- `backend/app/schemas/pulse_digest.py` (new)

**Acceptance Criteria:**
- `DigestResponse` — id, user_id, category, content, message_count, generated_at, period_start, period_end
- `DigestListResponse` — list of digests with pagination (offset/limit)
- `DigestGenerateRequest` — optional category filter
- `DigestGenerateResponse` — created digest or message if no new messages

**Verification:** Schema instantiation tests

---

### Task 4: Digest API router

**Description:** Create `backend/app/api/pulse_digests.py` with CRUD + generate endpoints. Register in main app.

**Files:**
- `backend/app/api/pulse_digests.py` (new)
- `backend/app/main.py` (register router)

**Acceptance Criteria:**
- `GET /api/pulse/digests/` — list digests (paginated, default limit=20, newest first)
- `GET /api/pulse/digests/latest` — latest digest (optional `?category=` filter)
- `GET /api/pulse/digests/{id}` — get specific digest by ID
- `POST /api/pulse/digests/generate` — trigger on-demand generation (optional category in body)
- All endpoints enforce user_id ownership
- Generate endpoint returns 404 if no new messages, 503 if LLM unavailable

**Verification:** API tests with test client

---

### Task 5: Scheduled digest generation via APScheduler

**Description:** Add digest scheduling to the scheduler module. Create/update cron jobs based on user's digest_schedule settings. Reschedule when settings change.

**Files:**
- `backend/app/core/scheduler.py` (extend)
- `backend/app/services/pulse_scheduler.py` (add digest job runner)
- `backend/app/services/pulse_settings.py` (reschedule on settings update)

**Acceptance Criteria:**
- `schedule_user_digest(user_id, schedule, time, day)` creates APScheduler cron job
- Job ID format: `pulse_digest_user_{user_id}`
- Supports: daily at HH:MM, every N days, weekly on specific day
- `remove_user_digest(user_id)` removes the job
- On startup: all users' digest jobs restored from DB settings
- Settings update triggers reschedule
- Digest job calls `generate_digest()` for the user

**Verification:** Unit tests for schedule creation/removal logic

---

### Task 6: Backend tests for digest service and API

**Description:** Comprehensive tests for digest generation, prompt building, API endpoints, and scheduling.

**Files:**
- `backend/tests/test_pulse_digest.py` (new)

**Acceptance Criteria:**
- Test digest generation with mocked LLM (news, jobs, learning categories)
- Test no-messages scenario returns None
- Test messages marked as "in_digest" after generation
- Test period_start/period_end correctness
- Test API endpoints: list, latest, get by ID, generate
- Test ownership enforcement (user can't see other user's digests)
- Test scheduled digest job creation and removal
- ≥10 tests total

**Verification:** `pytest backend/tests/test_pulse_digest.py` — all pass

---

### Task 7: Frontend digest API hook

**Description:** Create `use-pulse-digests.ts` hook for digest API calls.

**Files:**
- `frontend/src/hooks/use-pulse-digests.ts` (new)
- `frontend/src/types/pulse-digest.ts` (new)

**Acceptance Criteria:**
- `useDigests(limit?, offset?)` — fetch paginated list
- `useLatestDigest(category?)` — fetch latest digest
- `useDigest(id)` — fetch specific digest
- `generateDigest(category?)` — trigger generation, return result
- Types: `PulseDigest` interface matching backend schema
- Loading/error states handled

**Verification:** Frontend builds without errors

---

### Task 8: Pulse page — digest view with category tabs

**Description:** Create the main Pulse page with tabs per category (All, News, Jobs, Learning) showing the latest digest content rendered as markdown.

**Files:**
- `frontend/src/app/(dashboard)/pulse/page.tsx` (new or replace)
- `frontend/src/components/pulse/digest-view.tsx` (new)
- `frontend/src/components/pulse/category-tabs.tsx` (new)

**Acceptance Criteria:**
- Tabs: All, News, Jobs, Learning (derived from user's sources)
- Each tab shows latest digest for that category (or all)
- Markdown content rendered with proper formatting (headers, lists, bold)
- "Generate Now" button triggers on-demand generation with loading state
- Empty state when no digests exist yet
- Shows digest metadata: generated_at, message_count, period range

**Verification:** Visual check + frontend build

---

### Task 9: Digest history list

**Description:** Add digest history view — list of past digests with click to view full content.

**Files:**
- `frontend/src/components/pulse/digest-history.tsx` (new)
- `frontend/src/app/(dashboard)/pulse/page.tsx` (extend)

**Acceptance Criteria:**
- Toggle between "Latest" and "History" views
- History shows list of past digests: date, category, message count
- Click on a digest opens its full markdown content
- Pagination (load more)
- Empty state for no history

**Verification:** Visual check + frontend build

---

### Task 10: Sidebar navigation update

**Description:** Add Pulse main page to sidebar navigation (alongside existing Sources sub-item).

**Files:**
- `frontend/src/components/layout/sidebar.tsx` (or equivalent navigation component)

**Acceptance Criteria:**
- "Pulse" section in sidebar with sub-items: "Digests" (main page) and "Sources" (existing)
- Active state highlighting works correctly
- Icon consistent with design brief

**Verification:** Visual check + frontend build

---

### Task 11: Frontend tests for digest components

**Description:** Tests for digest view, category tabs, and API hook.

**Files:**
- `frontend/src/tests/pulse-digests.test.tsx` (new) or co-located tests

**Acceptance Criteria:**
- Test category tabs render and switch
- Test digest content renders markdown
- Test "Generate Now" button triggers API call
- Test empty state display
- Test loading state
- ≥5 tests

**Verification:** `npm test` — all pass

---

### Task 12: Integration — wire digest schedule to settings UI

**Description:** Ensure the existing Pulse Settings tab properly controls digest scheduling. When user changes digest_schedule/time/day, the backend reschedules the APScheduler job.

**Files:**
- `frontend/src/components/settings/pulse-settings-tab.tsx` (verify/extend)
- `backend/app/services/pulse_settings.py` (verify reschedule logic)

**Acceptance Criteria:**
- Changing digest_schedule in Settings UI updates backend and reschedules job
- Digest time picker works correctly
- Weekly day selector shown only when schedule = "weekly"
- Interval days field shown only when schedule = "every_2_days" (or similar)
- Settings persist and restore correctly

**Verification:** E2E: change setting → verify scheduler job updated

---

## Execution Order

```
Task 1 (core service) → Task 2 (prompts) → Task 3 (schemas) → Task 4 (API)
                                                                    ↓
Task 5 (scheduler) ←────────────────────────────────────────────────┘
    ↓
Task 6 (backend tests)
    ↓
Task 7 (frontend hook + types) → Task 8 (digest UI) → Task 9 (history)
                                      ↓
                                 Task 10 (sidebar)
                                      ↓
                                 Task 11 (frontend tests)
                                      ↓
                                 Task 12 (integration wire-up)
```

## Total: 12 tasks
