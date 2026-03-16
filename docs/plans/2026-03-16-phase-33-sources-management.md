# Phase 33: Sources Management

## Overview

CRUD API and UI for managing Telegram Pulse sources (channels/groups). Includes category system (news/jobs/learning/custom), per-source settings (subcategory, keywords, criteria), source resolution via Telethon, and a dedicated Sources management page.

**Result:** User can add, edit, and remove Telegram sources with categories and filters. Sources can be resolved from Telegram to auto-fill title/username.

## Tasks

### Task 1: Create Pydantic schemas for sources
- **Description:** Request/response schemas for source CRUD
- **Files:** `backend/app/schemas/pulse_source.py` (new)
- **Details:**
  - `PulseSourceCreate(telegram_id: int, username: Optional[str], title: str, category: str, subcategory: Optional[str], keywords: Optional[list[str]], criteria: Optional[dict])`
  - `PulseSourceUpdate(title: Optional[str], category: Optional[str], subcategory: Optional[str], keywords: Optional[list[str]], criteria: Optional[dict], is_active: Optional[bool])`
  - `PulseSourceResponse(id, user_id, telegram_id, username, title, category, subcategory, keywords, criteria, is_active, last_polled_at, created_at)` — from_attributes
  - `PulseSourceResolveResponse(telegram_id: int, username: Optional[str], title: str, members_count: Optional[int])`
  - Category validation: must be one of "news", "jobs", "learning", or any custom string
- **AC:** Schemas validate input, serialize output correctly
- **Verify:** Unit test with sample data

### Task 2: Create sources service
- **Description:** Service layer for source CRUD with ownership validation
- **Files:** `backend/app/services/pulse_source.py` (new)
- **Details:**
  - `list_sources(db, user_id)` — return all sources for user, ordered by category then title
  - `get_source(db, source_id, user_id)` — get single source, validate ownership, raise 404
  - `create_source(db, user_id, data)` — create source, check unique(user_id, telegram_id)
  - `update_source(db, source_id, user_id, data)` — update source fields, validate ownership
  - `delete_source(db, source_id, user_id)` — delete source, validate ownership
  - `resolve_source(db, user, identifier)` — use Telethon to resolve channel/group by username or invite link, return title, telegram_id, members_count
- **AC:** CRUD works, ownership enforced, resolve returns Telegram entity info
- **Verify:** Service tests (Task 5)

### Task 3: Create sources API router
- **Description:** REST endpoints for source management
- **Files:** `backend/app/api/pulse_sources.py` (new)
- **Details:**
  - `GET /api/pulse/sources/` — list all user's sources
  - `POST /api/pulse/sources/` — create a new source
  - `PATCH /api/pulse/sources/{id}` — update source settings
  - `DELETE /api/pulse/sources/{id}` — remove source (204)
  - `GET /api/pulse/sources/resolve?identifier=@channel_name` — resolve channel/group info from Telegram
  - All endpoints require `get_current_user` dependency
- **AC:** Endpoints return correct status codes and response bodies
- **Verify:** API tests (Task 5)

### Task 4: Register sources router in main app
- **Description:** Import and include pulse_sources router in FastAPI app
- **Files:** `backend/app/main.py` (modify)
- **AC:** Endpoints appear in `/docs` (OpenAPI schema)
- **Verify:** Import check

### Task 5: Backend tests for sources
- **Description:** Test source service and API endpoints
- **Files:** `backend/tests/test_pulse_sources.py` (new)
- **Tests:**
  - `test_create_source` — service creates source in DB
  - `test_create_source_duplicate_telegram_id` — raises error on duplicate (user_id, telegram_id)
  - `test_list_sources` — returns all sources for user
  - `test_get_source_ownership` — only owner can access
  - `test_update_source` — updates fields correctly
  - `test_delete_source` — removes source
  - `test_resolve_source` — mocked Telethon returns entity info
  - `test_api_list_sources` — HTTP GET returns list
  - `test_api_create_source` — HTTP POST returns created source
  - `test_api_update_source` — HTTP PATCH returns updated source
  - `test_api_delete_source` — HTTP DELETE returns 204
  - `test_api_resolve_source` — HTTP GET returns resolved info
- **AC:** All 12 tests pass
- **Verify:** `pytest tests/test_pulse_sources.py -v`

### Task 6: Create frontend TypeScript types for sources
- **Description:** Types for source API responses
- **Files:** `frontend/src/types/pulse-source.ts` (new)
- **Details:**
  - `PulseSource { id, user_id, telegram_id, username?, title, category, subcategory?, keywords?, criteria?, is_active, last_polled_at?, created_at }`
  - `PulseSourceCreate { telegram_id, username?, title, category, subcategory?, keywords?, criteria? }`
  - `PulseSourceUpdate { title?, category?, subcategory?, keywords?, criteria?, is_active? }`
  - `PulseSourceResolveResult { telegram_id, username?, title, members_count? }`
- **AC:** Types match backend schemas exactly
- **Verify:** TypeScript compilation passes

### Task 7: Create sources API hooks
- **Description:** TanStack Query hooks for source endpoints
- **Files:** `frontend/src/hooks/use-pulse-sources.ts` (new)
- **Details:**
  - `usePulseSources()` — GET /api/pulse/sources/
  - `useCreatePulseSource()` — POST mutation, invalidates list
  - `useUpdatePulseSource()` — PATCH mutation, invalidates list
  - `useDeletePulseSource()` — DELETE mutation, invalidates list
  - `useResolvePulseSource(identifier)` — GET query (enabled when identifier is non-empty)
- **AC:** Hooks follow existing patterns, error handling via sonner toast
- **Verify:** TypeScript compilation passes

### Task 8: Create Add Source dialog component
- **Description:** Dialog for adding a new source with resolve preview
- **Files:** `frontend/src/components/pulse/add-source-dialog.tsx` (new)
- **Details:**
  - Input field for channel username or invite link
  - "Resolve" button — calls resolve API, shows preview (title, members)
  - Category selector (news/jobs/learning/custom with free-text input)
  - Optional fields: subcategory, keywords (tag input), criteria (JSON for jobs)
  - "Add" button — creates source via API
  - Follow design-brief.md patterns
- **AC:** Dialog resolves sources, creates them with correct category
- **Verify:** Frontend tests (Task 11)

### Task 9: Create Sources list component
- **Description:** Table/list of user's sources with edit and delete actions
- **Files:** `frontend/src/components/pulse/sources-list.tsx` (new)
- **Details:**
  - Table columns: Title, Category, Subcategory, Status (active/paused), Last Polled, Actions
  - Edit action: inline or dialog to update category, subcategory, keywords, criteria, is_active
  - Delete action: with confirmation dialog
  - Empty state with CTA to add first source
- **AC:** Lists sources, edit/delete work
- **Verify:** Frontend tests (Task 11)

### Task 10: Create Pulse Sources page
- **Description:** Full page for managing sources, accessible from navigation
- **Files:** `frontend/src/app/(dashboard)/pulse/sources/page.tsx` (new), `frontend/src/app/(dashboard)/pulse/layout.tsx` (new)
- **Details:**
  - Header: "Pulse Sources" with "Add Source" button
  - Renders SourcesList component
  - Add Source button opens AddSourceDialog
  - Add "Pulse" section to sidebar navigation with sources sub-page
- **AC:** Page renders, add/edit/delete flow works
- **Verify:** Visual check + frontend tests

### Task 11: Frontend tests for sources
- **Description:** Component tests for sources UI
- **Files:** `frontend/__tests__/pulse-sources.test.tsx` (new)
- **Tests:**
  - `renders sources list with data`
  - `renders empty state when no sources`
  - `opens add source dialog`
  - `resolves source from identifier`
  - `creates source with category`
  - `deletes source with confirmation`
  - `edits source category`
- **AC:** All 7 tests pass
- **Verify:** `npx vitest run __tests__/pulse-sources.test.tsx`

### Task 12: Add Pulse to sidebar navigation
- **Description:** Add "Pulse" navigation item with "Sources" sub-link
- **Files:** `frontend/src/components/sidebar.tsx` or equivalent navigation component (modify)
- **AC:** Pulse section appears in navigation, links to /pulse/sources
- **Verify:** Visual check

## Dependencies

```
Task 1 (schemas — independent)
Task 1 → Task 2 → Task 3 → Task 4 (schemas → service → router → registration)
Task 2 + Task 3 → Task 5 (backend tests)
Task 6 (types — independent)
Task 6 → Task 7 (types → hooks)
Task 7 → Task 8, Task 9 (hooks → components)
Task 8 + Task 9 → Task 10 (components → page)
Task 8 + Task 9 → Task 11 (components → tests)
Task 10 → Task 12 (page → navigation)
```

## Execution Order

1. Task 1 — Schemas
2. Task 2 — Service
3. Task 3 — API router
4. Task 4 — Router registration
5. Task 5 — Backend tests
6. Task 6 — Frontend types
7. Task 7 — Hooks
8. Task 8 — Add Source dialog
9. Task 9 — Sources list
10. Task 10 — Pulse Sources page
11. Task 11 — Frontend tests
12. Task 12 — Sidebar navigation
