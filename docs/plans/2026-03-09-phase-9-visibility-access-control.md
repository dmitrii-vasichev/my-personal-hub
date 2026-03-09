# Phase 9 Plan: Visibility & Access Control

## Overview
Implement data visibility enforcement and owner-based access control. Members see their own records plus family-visible records from other users. Members can only edit/delete their own records. Admins see and edit everything. Jobs/applications remain strictly private per user.

## PRD References
- FR-12: Jobs/applications strictly private per user
- FR-13: Backend query filters: member sees own + others' `family` records; admin sees all
- FR-14: Member can only edit/delete own records; admin can edit/delete any
- FR-24: Visibility toggle (family/private) on task and event forms
- FR-25: Show owner name on family-visible records from other users

## Current State
- `visibility` field (enum: family/private) already exists in Task and CalendarEvent models (Phase 7)
- Visibility is indexed but **not used** in any queries
- Jobs/Applications have no visibility field (by design — always private)
- Current access: admin sees all, member sees own + assigned (tasks) or own only (calendar/jobs)
- No creator info returned in API responses
- No edit/delete restrictions — if you can see a record, you can edit it

## Tasks

### Task 1: Backend — Visibility-aware task queries + owner edit/delete restrictions
**Files:**
- `backend/app/services/task.py` — update `_task_query_for_user()` and `_can_access_task()`
- `backend/app/schemas/task.py` — add `visibility` to create/update schemas, add `owner_name` to response

**Changes:**
1. Update `_task_query_for_user(user)`:
   - Admin: return all tasks (no change)
   - Member: return `(Task.user_id == user.id) OR (Task.assignee_id == user.id) OR (Task.visibility == 'family')`
2. Update `_can_access_task(task, user)`:
   - Admin: always True (no change)
   - Member: True if own task, assigned to, or family-visible (read-only)
3. Add `_can_edit_task(task, user)` function:
   - Admin: always True
   - Member: True only if `task.user_id == user.id` or `task.assignee_id == user.id`
4. Apply `_can_edit_task()` check in `update_task()` and `delete_task()` — raise 403 if not allowed
5. Add `visibility` field to `TaskCreate` and `TaskUpdate` schemas (optional, default: family)
6. Add `owner_name` to `TaskResponse` schema (from joined user.display_name)
7. Update task queries to joinedload User for owner display_name

**Acceptance Criteria:**
- [ ] Member sees own tasks + assigned tasks + family tasks from other users
- [ ] Member does NOT see other users' private tasks
- [ ] Member can edit/delete only own or assigned tasks
- [ ] Member gets 403 when trying to edit other users' family tasks
- [ ] Admin sees all tasks regardless of visibility
- [ ] Admin can edit/delete any task
- [ ] Creating task with `visibility: "private"` hides it from other members
- [ ] API response includes `owner_name` field

**Verification:** Run task-related tests + manual API tests with two users

---

### Task 2: Backend — Visibility-aware calendar event queries + owner restrictions
**Files:**
- `backend/app/services/calendar.py` — update `_events_base_query()` and `_can_access_event()`
- `backend/app/schemas/calendar.py` — add `visibility` to create/update, `owner_name` to response

**Changes:**
1. Update `_events_base_query(user)`:
   - Admin: return all events (no change)
   - Member: return `(CalendarEvent.user_id == user.id) OR (CalendarEvent.visibility == 'family')`
2. Update `_can_access_event(event, user)`:
   - Admin: always True
   - Member: True if own event or family-visible
3. Add `_can_edit_event(event, user)`:
   - Admin: always True
   - Member: True only if `event.user_id == user.id`
4. Apply `_can_edit_event()` in `update_event()`, `delete_event()` — raise 403 if not allowed
5. Add `visibility` to `CalendarEventCreate` and `CalendarEventUpdate` schemas
6. Add `owner_name` to `CalendarEventResponse` schema
7. Update event queries to joinedload User for owner name
8. Event notes: keep existing rule — only author can edit their notes

**Acceptance Criteria:**
- [ ] Member sees own events + family events from other users
- [ ] Member does NOT see other users' private events
- [ ] Member can edit/delete only own events
- [ ] Member gets 403 when trying to edit other users' family events
- [ ] Admin sees all events
- [ ] API response includes `owner_name`

**Verification:** Run calendar-related tests + manual API tests

---

### Task 3: Backend — Jobs/applications strict user_id filter (verify & harden)
**Files:**
- `backend/app/services/job.py` — verify filtering
- `backend/app/services/application.py` — verify filtering

**Changes:**
1. Verify `list_jobs()` strictly filters by `user_id` for members (already does, confirm)
2. Verify `list_applications()` strictly filters by `user_id` for members
3. Verify `_can_access()` in both services checks ownership for members
4. Verify edit/delete also checks ownership
5. If any gaps found, fix them
6. Add explicit comment: "Jobs and applications are always private per user — no visibility field"

**Acceptance Criteria:**
- [ ] Member sees only own jobs
- [ ] Member sees only own applications
- [ ] Member cannot access other users' jobs/applications via direct ID
- [ ] Admin sees all jobs and applications

**Verification:** Run job/application tests

---

### Task 4: Backend — Tests for visibility and access control
**Files:**
- `backend/tests/test_visibility.py` (new)
- `backend/tests/test_access_control.py` (new)

**Tests to write:**

Visibility tests:
- Member creates family task → other member can see it
- Member creates private task → other member cannot see it
- Member creates family event → other member can see it
- Member creates private event → other member cannot see it
- Admin sees all tasks/events regardless of visibility
- Default visibility is `family`

Access control tests:
- Member can edit own task → 200
- Member cannot edit other member's family task → 403
- Member can delete own task → 200
- Member cannot delete other member's task → 403
- Same for calendar events
- Admin can edit any task → 200
- Admin can delete any event → 200
- Member cannot see other member's jobs → filtered out
- Member cannot access other member's job by ID → 403/404

**Acceptance Criteria:**
- [ ] All visibility tests pass
- [ ] All access control tests pass
- [ ] Existing tests still pass (no regressions)

**Verification:** `python -m pytest tests/ -v`

---

### Task 5: Frontend — Update types and hooks for visibility + owner info
**Files:**
- `frontend/src/types/task.ts` — add `visibility`, `owner_name`
- `frontend/src/types/calendar.ts` — add `visibility`, `owner_name`
- `frontend/src/hooks/use-tasks.ts` — add `visibility` to CreateTaskInput, UpdateTaskInput
- `frontend/src/hooks/use-calendar.ts` — add `visibility` to create/update inputs

**Changes:**
1. Task interface: add `visibility?: "family" | "private"` and `owner_name?: string`
2. CalendarEvent interface: add `visibility?: "family" | "private"` and `owner_name?: string`
3. CreateTaskInput: add `visibility?: "family" | "private"`
4. UpdateTaskInput: add `visibility?: "family" | "private"`
5. CalendarEventCreate: add `visibility?: "family" | "private"`
6. CalendarEventUpdate: add `visibility?: "family" | "private"`

**Acceptance Criteria:**
- [ ] Types compile without errors
- [ ] Frontend build succeeds

**Verification:** `npm run build`

---

### Task 6: Frontend — Visibility toggle on task and calendar event forms
**Files:**
- `frontend/src/components/tasks/task-dialog.tsx` — add visibility select
- `frontend/src/components/calendar/event-dialog.tsx` — add visibility select

**Changes:**
1. Task dialog: add a Select/SegmentedControl for visibility (family/private)
   - Default: `family`
   - Position: after priority field
   - Icons: Globe for family, Lock for private
   - When editing existing task, show current visibility value
2. Calendar event dialog: same pattern
   - Position: after description field
3. Both forms send `visibility` in the create/update payload

**Acceptance Criteria:**
- [ ] Task dialog shows visibility toggle
- [ ] Event dialog shows visibility toggle
- [ ] Default is "family" for new records
- [ ] Editing preserves current visibility value
- [ ] Saving sends visibility to API

**Verification:** Visual check + create task with private visibility, verify in API

---

### Task 7: Frontend — Owner name display and visibility indicators on cards
**Files:**
- `frontend/src/components/tasks/task-card.tsx` — add owner name, lock icon
- `frontend/src/components/calendar/event-pill.tsx` — add owner indicator
- `frontend/src/app/(dashboard)/tasks/[id]/page.tsx` — add owner info in sidebar
- `frontend/src/components/calendar/event-detail` or event detail page — add owner info

**Changes:**
1. Task card: show owner name when `task.user_id !== currentUser.id` (i.e., it's another user's family task)
   - Small text: "By {owner_name}" next to assignee
   - Lock icon if visibility is private (though member won't normally see these)
2. Event pill: show owner initial/name for other users' family events
   - Subtle indicator to distinguish own vs others' events
3. Task detail sidebar: show "Created by" with owner name
4. Calendar event detail: show "Created by" with owner name

**Acceptance Criteria:**
- [ ] Task card shows owner name for other users' tasks
- [ ] Event pill shows indicator for other users' events
- [ ] Task detail shows creator info
- [ ] Event detail shows creator info

**Verification:** Visual check with two user accounts

---

### Task 8: Frontend — Edit/delete restrictions for members
**Files:**
- `frontend/src/components/tasks/task-card.tsx` — conditionally show edit/delete
- `frontend/src/components/tasks/kanban-board.tsx` — restrict drag for non-owned tasks
- `frontend/src/app/(dashboard)/tasks/[id]/page.tsx` — disable edit/delete buttons
- `frontend/src/components/calendar/event-dialog.tsx` — prevent editing non-owned
- `frontend/src/components/jobs/job-card.tsx` — hide edit/delete for non-owned jobs
- `frontend/src/components/jobs/job-detail.tsx` — disable edit/delete for non-owned

**Changes:**
1. Add helper: `canEditRecord(record, currentUser)` — true if admin or owner
2. Task card: hide edit/delete actions for non-owned tasks (member viewing family task)
3. Kanban board: prevent drag-and-drop status change for non-owned tasks
4. Task detail page: hide edit button, show "View Only" state for non-owned tasks
5. Calendar: prevent editing/deleting non-owned events
6. Jobs: hide edit/delete for non-owned jobs (applies when admin creates jobs visible to member — but since jobs are always private, this may only matter for admin seeing all jobs)
7. Show a subtle "Read only" badge or disable edit controls

**Acceptance Criteria:**
- [ ] Member cannot edit/delete other users' family tasks (no edit buttons shown)
- [ ] Member cannot drag other users' family tasks on kanban
- [ ] Member cannot edit/delete other users' family events
- [ ] Admin can edit/delete any record
- [ ] Graceful UI — no broken states, clear visual indication

**Verification:** Visual check with member account viewing family records

---

## Task Dependencies

```
Task 1 (Tasks backend) ──┐
Task 2 (Calendar backend) ├── Task 4 (Tests) ──┐
Task 3 (Jobs verify) ─────┘                    │
                                                 ├── Task 6 (Visibility toggle)
Task 5 (Types/hooks) ──────────────────────────┤
                                                 ├── Task 7 (Owner display)
                                                 │
                                                 └── Task 8 (Edit restrictions)
```

- Tasks 1, 2, 3 can run in parallel (independent backend services)
- Task 4 depends on 1, 2, 3 (tests need working backend)
- Task 5 can start independently (type definitions)
- Tasks 6, 7, 8 depend on Task 5 (need updated types)
- Tasks 6, 7, 8 also need Tasks 1-2 for API to work correctly

## Execution Order
1. Tasks 1 + 2 + 3 (parallel backend work)
2. Task 4 (backend tests)
3. Task 5 (frontend types)
4. Tasks 6 + 7 + 8 (parallel frontend work)

## Estimated Scope
- 8 tasks total
- Backend: 4 tasks (services, schemas, tests)
- Frontend: 4 tasks (types, forms, display, restrictions)
