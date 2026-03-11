# Phase 26: Kanban Board UX Improvements

**PRD:** `docs/prd-kanban-ux-improvements.md`
**Phase:** 26
**Date:** 2026-03-11
**Tasks:** 7

---

## Task 1: Backend — Alembic migration for `kanban_hidden_columns`

**Description:** Add `kanban_hidden_columns` JSON column to `user_settings` table.

**Files:**
- `backend/alembic/versions/XXX_add_kanban_hidden_columns.py` (new)

**Acceptance Criteria:**
- [ ] Migration adds `kanban_hidden_columns` column (JSON, NOT NULL, server_default='[]')
- [ ] Migration is reversible (downgrade drops column)
- [ ] `alembic upgrade head` succeeds

**Verification:** `cd backend && alembic upgrade head`

---

## Task 2: Backend — Update UserSettings model & schemas

**Description:** Add `kanban_hidden_columns` field to model, SettingsUpdate, and SettingsResponse schemas.

**Files:**
- `backend/app/models/settings.py`
- `backend/app/schemas/settings.py`

**Acceptance Criteria:**
- [ ] Model has `kanban_hidden_columns: Mapped[list]` with JSON type, default=[]
- [ ] `SettingsUpdate` accepts `kanban_hidden_columns: Optional[list[str]]`
- [ ] `SettingsResponse` returns `kanban_hidden_columns: list[str]`
- [ ] Existing settings tests still pass

**Verification:** `cd backend && python -m pytest tests/ -x`

---

## Task 3: Frontend — Remove deadline filter from TaskFiltersBar

**Description:** Remove the "Due before" DatePicker from filter bar and clean up `deadline_before`/`deadline_after` from `TaskFilters` type.

**Files:**
- `frontend/src/types/task.ts` — remove `deadline_before`, `deadline_after` from `TaskFilters`
- `frontend/src/components/tasks/task-filters.tsx` — remove DatePicker and related state
- `frontend/src/hooks/use-tasks.ts` — remove deadline params from query key/params
- `frontend/src/app/(dashboard)/tasks/page.tsx` — clean up if needed

**Acceptance Criteria:**
- [ ] DatePicker removed from filter bar
- [ ] `TaskFilters` no longer has deadline fields
- [ ] Active filters count no longer counts deadline
- [ ] Backend API still supports deadline params (no backend changes)

**Verification:** `cd frontend && npm run build && npm test`

---

## Task 4: Frontend — Priority colored left border on TaskCard

**Description:** Replace priority text label + dot with a 3px colored left border on the card.

**Files:**
- `frontend/src/types/task.ts` — add `PRIORITY_BORDER_COLORS` constant
- `frontend/src/components/tasks/task-card.tsx` — remove priority badge, add border-left
- `frontend/src/components/tasks/kanban-column.tsx` — adjust if needed

**Acceptance Criteria:**
- [ ] Priority text label and dot removed from card
- [ ] Card has 3px left border: urgent=red, high=amber, medium=blue, low=gray
- [ ] TaskCardOverlay (drag) also has the border
- [ ] Works in both dark and light themes

**Verification:** `cd frontend && npm run build && npm test`

---

## Task 5: Frontend — Done column collapse (Show all / Show less)

**Description:** Limit Done column to 10 cards with expand/collapse toggle.

**Files:**
- `frontend/src/components/tasks/kanban-column.tsx`

**Acceptance Criteria:**
- [ ] Done column shows max 10 tasks by default
- [ ] "Show all (N)" button appears when >10 tasks
- [ ] Clicking expands to show all, button becomes "Show less"
- [ ] Collapse state resets on page reload
- [ ] Other columns unaffected

**Verification:** `cd frontend && npm run build && npm test`

---

## Task 6: Frontend — Configurable column visibility with "Columns" button

**Description:** Add "Columns" button in filter bar with popover to toggle column visibility. Persist in UserSettings via API.

**Files:**
- `frontend/src/types/settings.ts` — add `kanban_hidden_columns` to settings type
- `frontend/src/hooks/use-settings.ts` — ensure settings hook returns new field
- `frontend/src/components/tasks/task-filters.tsx` — add Columns button + popover
- `frontend/src/components/tasks/kanban-board.tsx` — accept and apply `hiddenColumns` prop
- `frontend/src/app/(dashboard)/tasks/page.tsx` — wire up hidden columns state from settings

**Acceptance Criteria:**
- [ ] "Columns" button in filter bar opens popover with checkboxes
- [ ] Default hidden: review, cancelled (when user has no saved preference)
- [ ] At least 2 columns must remain visible
- [ ] Changes saved to UserSettings via debounced API call (500ms)
- [ ] Hidden columns persist across reloads
- [ ] Drag-and-drop works correctly with visible columns only

**Verification:** `cd frontend && npm run build && npm test`

---

## Task 7: Tests for kanban UX improvements

**Description:** Add backend tests for the new settings field and frontend tests for updated components.

**Files:**
- `backend/tests/test_settings.py` — test kanban_hidden_columns CRUD
- `frontend/src/__tests__/kanban-ux.test.tsx` (new) — test column visibility, done collapse, priority border

**Acceptance Criteria:**
- [ ] Backend: test GET/PUT settings with kanban_hidden_columns
- [ ] Frontend: test TaskCard renders priority border
- [ ] Frontend: test KanbanColumn done collapse behavior
- [ ] All existing tests still pass

**Verification:** `cd backend && python -m pytest tests/ -x && cd ../frontend && npm test`

---

## Execution Order

1. Task 1 → Task 2 (backend, sequential — migration then model)
2. Task 3 (frontend, independent — remove deadline filter)
3. Task 4 (frontend, independent — priority border)
4. Task 5 (frontend, independent — done collapse)
5. Task 6 (frontend, depends on Task 2 — column visibility + settings)
6. Task 7 (tests, after all implementation)
