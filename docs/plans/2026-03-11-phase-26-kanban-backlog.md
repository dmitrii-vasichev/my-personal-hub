# Phase 26: Kanban Backlog Status

## Overview
Add `backlog` status to the task kanban board — backend enum, Alembic migration, schema, service, and all frontend references.

## Tasks

### Task 1: Backend — Add `backlog` to TaskStatus enum
**Files:** `backend/app/models/task.py`
**Changes:**
- Add `backlog = "backlog"` as the first value in `TaskStatus` enum (before `new`)

**Acceptance Criteria:**
- [ ] `TaskStatus.backlog` exists and equals `"backlog"`
- [ ] It is the first member of the enum

---

### Task 2: Backend — Alembic migration for PostgreSQL enum
**Files:** `backend/alembic/versions/020_add_backlog_status.py`
**Changes:**
- Create migration `020_add_backlog_status.py`
- `upgrade()`: `ALTER TYPE taskstatus ADD VALUE 'backlog' BEFORE 'new'`
- `downgrade()`: pass (PostgreSQL enum value removal is complex, skip for personal project)

**Acceptance Criteria:**
- [ ] Migration runs without errors
- [ ] `backlog` value exists in `taskstatus` PostgreSQL enum after migration

---

### Task 3: Backend — Update KanbanBoard schema
**Files:** `backend/app/schemas/task.py`
**Changes:**
- Add `backlog: list[TaskResponse] = []` as the first field in `KanbanBoard` model

**Acceptance Criteria:**
- [ ] KanbanBoard schema includes `backlog` field
- [ ] API response includes `backlog` key

---

### Task 4: Backend — Update get_kanban_board service
**Files:** `backend/app/services/task.py`
**Changes:**
- `get_kanban_board()`: include `backlog` in the returned board dict
- `create_task()`: when creating a task with `backlog` status, place at top of backlog column (existing `_get_min_kanban_order` logic handles this automatically since it takes status as parameter)

**Acceptance Criteria:**
- [ ] `/api/tasks/kanban` returns a `backlog` key with tasks
- [ ] Tasks with `backlog` status appear in the backlog column

---

### Task 5: Backend — Tests for backlog status
**Files:** `backend/tests/test_task*.py` (existing test files)
**Changes:**
- Add test: create task with `status=backlog` → succeeds
- Add test: kanban board response includes `backlog` key
- Add test: move task from `backlog` to `new` via update

**Acceptance Criteria:**
- [ ] All new tests pass
- [ ] Existing tests still pass

---

### Task 6: Frontend — Add `backlog` to types and constants
**Files:** `frontend/src/types/task.ts`
**Changes:**
- Add `"backlog"` to `TaskStatus` type
- Add `"backlog"` as first element in `TASK_STATUS_ORDER`
- Add `backlog: "Backlog"` to `TASK_STATUS_LABELS`
- Add `backlog` to `KanbanBoard` interface

**Acceptance Criteria:**
- [ ] TypeScript compiles without errors
- [ ] `TASK_STATUS_ORDER[0]` is `"backlog"`

---

### Task 7: Frontend — Update kanban-board.tsx and kanban-column.tsx
**Files:**
- `frontend/src/components/tasks/kanban-board.tsx`
- `frontend/src/components/tasks/kanban-column.tsx`
**Changes:**
- `kanban-column.tsx`: Add `backlog: "bg-[var(--accent-violet)]"` to `STATUS_ACCENT`
- `kanban-board.tsx`: No changes needed (uses TASK_STATUS_ORDER dynamically)

**Acceptance Criteria:**
- [ ] Backlog column renders with purple accent dot
- [ ] Column is visible by default (not in hidden columns)

---

### Task 8: Frontend — Update tasks page EMPTY_BOARD and task-dialog
**Files:**
- `frontend/src/app/(dashboard)/tasks/page.tsx`
- `frontend/src/components/tasks/task-dialog.tsx`
**Changes:**
- `page.tsx`: Add `backlog: []` to `EMPTY_BOARD`
- `task-dialog.tsx`: Add `backlog` as selectable status option (if status selector exists; otherwise verify it works through TASK_STATUS_ORDER)

**Acceptance Criteria:**
- [ ] Empty board includes backlog column
- [ ] Task dialog allows selecting `backlog` status
- [ ] Default status for new tasks remains `new`

---

### Task 9: Frontend — Tests
**Files:** `frontend/src/__tests__/` or co-located test files
**Changes:**
- Test that TASK_STATUS_ORDER starts with "backlog"
- Test that TASK_STATUS_LABELS includes backlog
- Test that KanbanColumn renders with backlog status

**Acceptance Criteria:**
- [ ] All frontend tests pass
- [ ] Build succeeds without errors

## Dependency Order
Tasks 1-5 (backend) can be done as a group, then Tasks 6-9 (frontend) as a group.
Within backend: Task 1 → Task 2 → Task 3 → Task 4 → Task 5
Within frontend: Task 6 → Task 7 → Task 8 → Task 9

## Verification
```bash
# Backend
cd backend && python -m pytest tests/ -v

# Frontend
cd frontend && npm run lint && npm run build && npm test
```
