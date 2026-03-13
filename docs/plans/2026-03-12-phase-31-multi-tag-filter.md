# Phase 31: Multi-Tag Filter

**PRD**: `docs/prd-multi-tag-filter.md`
**Date**: 2026-03-12

## Tasks

### Task 1: Backend — replace `tag_id` with `tag_ids` in service layer
**Files**: `backend/app/services/task.py`
**Changes**:
- Replace `tag_id: Optional[int] = None` param with `tag_ids: Optional[str] = None` (comma-separated, supports `untagged`)
- Parse comma-separated string into list of int IDs + boolean `include_untagged`
- Filter: `TaskTag.tag_id IN (list)` OR `task has no tags` (when `untagged` in list)
- Use subquery for untagged: `~Task.id.in_(select(TaskTag.task_id))`
- Update `list_tasks()` and `get_kanban_board()` passthrough

**Acceptance Criteria**:
- [ ] `tag_ids=5,8` returns tasks tagged with 5 OR 8
- [ ] `tag_ids=untagged` returns only tasks with no tags
- [ ] `tag_ids=5,untagged` returns tasks tagged 5 + untagged tasks
- [ ] No `tag_ids` param returns all tasks (no filtering)
- [ ] Tests pass

---

### Task 2: Backend — update API endpoints
**Files**: `backend/app/api/tasks.py`
**Changes**:
- Replace `tag_id: Optional[int] = Query(None)` with `tag_ids: Optional[str] = Query(None)` in both `/kanban` and `/` endpoints
- Pass `tag_ids` string to service layer

**Acceptance Criteria**:
- [ ] `GET /api/tasks/kanban/?tag_ids=5,8` works
- [ ] `GET /api/tasks/?tag_ids=5,untagged` works
- [ ] Old `tag_id` param no longer accepted (breaking change OK, frontend updates together)

---

### Task 3: Backend — tests for multi-tag filtering
**Files**: `backend/tests/test_multi_tag_filter.py`
**Changes**:
- Test: filter by single tag_id
- Test: filter by multiple tag_ids (OR logic)
- Test: filter by `untagged` only
- Test: filter by tag_ids + untagged combined
- Test: no tag_ids param returns all tasks

**Acceptance Criteria**:
- [ ] All 5 test cases pass
- [ ] Tests use real DB (not mocks)

---

### Task 4: Frontend — update `TaskFilters` type and query builder
**Files**: `frontend/src/types/task.ts`, `frontend/src/hooks/use-tasks.ts`
**Changes**:
- `TaskFilters`: remove `tag_id?: number`, add `tag_ids?: number[]`, `include_untagged?: boolean`
- `buildTaskQuery()`: build `tag_ids` param as comma-separated string, append `untagged` when `include_untagged` is true

**Acceptance Criteria**:
- [ ] Query string correctly built: `?tag_ids=5,8,untagged`
- [ ] No `tag_ids` param sent when all tags selected (no filtering needed)
- [ ] TypeScript compiles without errors

---

### Task 5: Frontend — multi-select tag filter UI
**Files**: `frontend/src/components/tasks/task-filters.tsx`
**Changes**:
- Replace single-select logic with multi-select (Set or array of selected tag IDs)
- Add checkboxes (or check marks) next to each tag
- Add "No tag" virtual item with `∅` icon
- "All tags" toggles select-all / deselect-all
- Button label: "Tags" when all selected, "Tags (N)" when partial selection
- Dropdown stays open on click (don't close on tag toggle)
- `activeCount` calculation: count tag filter as active when not all tags selected

**Acceptance Criteria**:
- [ ] Multiple tags can be toggled independently
- [ ] "All tags" selects/deselects everything
- [ ] "No tag" item toggles untagged tasks
- [ ] Visual feedback (checkmarks) for selected tags
- [ ] Dropdown doesn't close on tag click

---

### Task 6: Frontend — URL sync + sessionStorage persistence
**Files**: `frontend/src/app/(dashboard)/tasks/page.tsx`
**Changes**:
- Read initial state: URL `?tags=5,8,untagged` → parse into `tag_ids` + `include_untagged`
- If no URL params, check sessionStorage key `tasks-filter-tags` → restore
- On filter change: write to both URL and sessionStorage
- When all tags selected: remove `tags` param from URL, clear sessionStorage key
- "Back to tasks" button: use `router.back()` when applicable

**Acceptance Criteria**:
- [ ] URL updates on filter change: `?tags=5,8,untagged`
- [ ] Page reload restores filters from URL
- [ ] Navigate to task → back → filters preserved via sessionStorage
- [ ] New tab → `/tasks` → all tags selected (clean state)

---

### Task 7: Frontend — tests for multi-tag filter
**Files**: `frontend/src/__tests__/multi-tag-filter.test.tsx`
**Changes**:
- Test: TaskFiltersBar renders all tags with checkmarks
- Test: toggling a tag updates filters correctly
- Test: "All tags" toggles all
- Test: "No tag" item works
- Test: buildTaskQuery produces correct query string

**Acceptance Criteria**:
- [ ] All tests pass
- [ ] `npm run build` succeeds

## Order of Execution

1. Task 1 (backend service) → Task 2 (backend API) → Task 3 (backend tests)
2. Task 4 (frontend types/hooks) → Task 5 (UI) → Task 6 (URL/persistence) → Task 7 (frontend tests)

Backend and frontend tracks can run in parallel but will be done sequentially in one branch.

## Dependencies
- Phase 30 (Tag Management) must be merged — ✅ already merged
