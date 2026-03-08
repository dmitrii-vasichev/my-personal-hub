# Phase 2: Task Manager

## Overview
Full task management module — backend API (CRUD, filters, timeline, assignment) and frontend UI (Kanban board with drag-and-drop, task detail view, checklists, comments timeline, filters).

Covers: FR-7 through FR-15.

## Tasks

### Task 1 (#11): Database schema — tasks + task_updates tables
**Description:** Create SQLAlchemy models for `tasks` and `task_updates` tables with Alembic migration. Define enums for status, priority, update type, and source.

**Files:**
- `backend/app/models/task.py` — Task and TaskUpdate models
- `backend/app/models/__init__.py` — re-export models
- `backend/alembic/versions/002_create_tasks.py` — migration

**Schema (tasks):**
- `id` UUID, PK
- `user_id` UUID, FK → users.id (creator/owner)
- `title` VARCHAR(255), NOT NULL
- `description` TEXT, nullable
- `status` ENUM(new, in_progress, review, done, cancelled), default "new"
- `priority` ENUM(urgent, high, medium, low), default "medium"
- `checklist` JSONB, default [] — array of {id, text, completed}
- `deadline` TIMESTAMP, nullable
- `reminder_at` TIMESTAMP, nullable
- `assignee_id` UUID, FK → users.id, nullable
- `created_by_id` UUID, FK → users.id, NOT NULL
- `source` ENUM(web), default "web"
- `short_id` SERIAL (auto-increment integer for display: TASK-1, TASK-2)
- `created_at` TIMESTAMP, default now()
- `updated_at` TIMESTAMP, default now(), onupdate
- `completed_at` TIMESTAMP, nullable

**Schema (task_updates):**
- `id` UUID, PK
- `task_id` UUID, FK → tasks.id, NOT NULL
- `author_id` UUID, FK → users.id, NOT NULL
- `type` ENUM(progress, status_change, comment, blocker)
- `content` TEXT, nullable
- `old_status` VARCHAR, nullable
- `new_status` VARCHAR, nullable
- `progress_percent` INTEGER, nullable
- `created_at` TIMESTAMP, default now()

**Acceptance Criteria:**
- [ ] `alembic upgrade head` creates both tables
- [ ] All fields match PRD spec
- [ ] Indexes on: tasks.user_id, tasks.assignee_id, tasks.status, tasks.priority
- [ ] FK constraints with CASCADE delete for task_updates
- [ ] short_id auto-increments per new task

**Verification:** `alembic upgrade head` succeeds, `\d tasks` and `\d task_updates` show correct schemas

---

### Task 2 (#12): Tasks CRUD API — create, read, update, delete
**Description:** Core task endpoints: create task, get task by ID, update task fields, delete task. Pydantic schemas for request/response. Service layer with business logic.

**Files:**
- `backend/app/api/tasks.py` — tasks router
- `backend/app/schemas/task.py` — Pydantic schemas
- `backend/app/services/task.py` — task business logic

**Endpoints:**
- `POST /api/tasks/` — create task (title required, optional: description, priority, deadline, checklist, assignee_id)
- `GET /api/tasks/{id}` — get task by ID (with creator and assignee info)
- `PATCH /api/tasks/{id}` — update task fields (partial update)
- `DELETE /api/tasks/{id}` — soft delete or hard delete

**Access Rules:**
- User sees: tasks they created + tasks assigned to them
- Admin sees: all tasks

**Acceptance Criteria:**
- [ ] Create task sets created_by_id = current user, source = "web"
- [ ] Get task returns full task with nested user info (creator, assignee)
- [ ] Update supports partial updates (only changed fields)
- [ ] Status change via update auto-sets completed_at when status = "done"
- [ ] Delete removes task and cascades to task_updates
- [ ] Non-owner/non-assignee gets 403 (unless admin)

**Verification:** curl POST create → GET returns task → PATCH updates → DELETE removes

---

### Task 3 (#13): Tasks list API with filters + Kanban endpoint
**Description:** List tasks with filtering, sorting, and a dedicated Kanban endpoint that returns tasks grouped by status.

**Files:**
- `backend/app/api/tasks.py` — add list and kanban endpoints
- `backend/app/services/task.py` — add list/filter logic

**Endpoints:**
- `GET /api/tasks/` — list tasks with query params:
  - `status` — filter by status (comma-separated for multiple)
  - `priority` — filter by priority
  - `assignee_id` — filter by assignee
  - `search` — search in title and description (ILIKE)
  - `deadline_before` — tasks with deadline before date
  - `deadline_after` — tasks with deadline after date
  - `sort_by` — field to sort (created_at, deadline, priority), default created_at
  - `sort_order` — asc/desc, default desc
- `GET /api/tasks/kanban` — returns tasks grouped by status columns

**Acceptance Criteria:**
- [ ] All filters work correctly and can be combined
- [ ] Search is case-insensitive (ILIKE)
- [ ] Kanban endpoint returns `{new: [...], in_progress: [...], review: [...], done: [...], cancelled: [...]}`
- [ ] Results respect access rules (user sees own + assigned, admin sees all)
- [ ] Empty filters return all accessible tasks

**Verification:** curl with various filter combinations returns correct results

---

### Task 4 (#14): Task updates API — timeline, comments, status changes
**Description:** Task updates/comments timeline. Auto-create status_change updates when task status changes. Manual creation of comment, progress, and blocker updates.

**Files:**
- `backend/app/api/task_updates.py` — task updates router
- `backend/app/schemas/task.py` — add update schemas
- `backend/app/services/task.py` — add update logic, status change hook

**Endpoints:**
- `GET /api/tasks/{id}/updates/` — list updates for a task (ordered by created_at desc)
- `POST /api/tasks/{id}/updates/` — create update (type: comment, progress, blocker)

**Auto-generated updates:**
- When task status changes (via PATCH), auto-create a `status_change` update with old_status/new_status
- When task is created, auto-create an initial update

**Acceptance Criteria:**
- [ ] Comment updates store content text
- [ ] Progress updates store progress_percent (0-100)
- [ ] Blocker updates store content describing the blocker
- [ ] Status change updates auto-created with old/new status
- [ ] Timeline ordered newest first
- [ ] Only task owner/assignee/admin can add updates

**Verification:** Change task status → GET updates shows auto status_change entry; POST comment → appears in timeline

---

### Task 5 (#15): Task assignment + admin access control
**Description:** Admin can assign tasks to any user. Ensure proper access control — user sees own + assigned tasks, admin sees all.

**Files:**
- `backend/app/api/tasks.py` — update create/update to handle assignee
- `backend/app/services/task.py` — assignment logic

**Behavior:**
- `assignee_id` field on create/update — admin can set to any user, regular user can only assign to self
- When assignee changes, auto-create a task update noting the assignment
- `GET /api/users/` already exists for admin to pick assignees

**Acceptance Criteria:**
- [ ] Admin can assign task to any user via create or update
- [ ] Regular user can only self-assign (assignee_id = own id or null)
- [ ] Assignment change creates a task update entry
- [ ] User sees tasks where user_id = self OR assignee_id = self
- [ ] Admin sees all tasks regardless of ownership

**Verification:** Admin assigns task to user → user sees it in their task list; user tries to assign to other → 403

---

### Task 6 (#16): Frontend — TanStack Query setup + Task types + API hooks
**Description:** Install TanStack Query, create TypeScript interfaces for tasks, add API client methods, and build reusable query/mutation hooks.

**Files:**
- `frontend/src/lib/query-provider.tsx` — QueryClientProvider wrapper
- `frontend/src/types/task.ts` — Task, TaskUpdate, enums
- `frontend/src/lib/api.ts` — add task API methods (or separate file)
- `frontend/src/hooks/use-tasks.ts` — query hooks (useKanbanTasks, useTask, useCreateTask, useUpdateTask, etc.)
- `frontend/src/app/layout.tsx` — add QueryClientProvider

**Types:**
```typescript
enum TaskStatus { New, InProgress, Review, Done, Cancelled }
enum TaskPriority { Urgent, High, Medium, Low }
enum UpdateType { Progress, StatusChange, Comment, Blocker }

interface ChecklistItem { id: string; text: string; completed: boolean }

interface Task {
  id: string; short_id: number; title: string; description?: string;
  status: TaskStatus; priority: TaskPriority;
  checklist: ChecklistItem[]; deadline?: string;
  assignee_id?: string; assignee?: User;
  created_by_id: string; creator?: User;
  source: string; created_at: string; updated_at: string; completed_at?: string;
}

interface TaskUpdate {
  id: string; task_id: string; author_id: string; author?: User;
  type: UpdateType; content?: string;
  old_status?: string; new_status?: string;
  progress_percent?: number; created_at: string;
}
```

**Acceptance Criteria:**
- [ ] TanStack Query installed and provider configured
- [ ] All TypeScript types match backend schemas
- [ ] API methods for: createTask, getTask, listTasks, updateTask, deleteTask, getKanbanTasks, getTaskUpdates, createTaskUpdate
- [ ] Query hooks with proper cache invalidation
- [ ] Optimistic updates for status changes (drag-and-drop)

**Verification:** Import hooks in a test component → data fetches correctly

---

### Task 7 (#17): Frontend — Kanban board with drag-and-drop
**Description:** Kanban board page at `/tasks` with columns (New, In Progress, Review, Done, Cancelled). Task cards with priority badge, title, deadline. Drag-and-drop between columns using @dnd-kit. Mobile: column tabs instead of drag.

**Files:**
- `frontend/src/app/(dashboard)/tasks/page.tsx` — tasks page
- `frontend/src/components/tasks/kanban-board.tsx` — board container
- `frontend/src/components/tasks/kanban-column.tsx` — single column
- `frontend/src/components/tasks/task-card.tsx` — card component

**Design (per design-brief.md):**
- Column background: transparent
- Column header: text-secondary, 12px, uppercase, count badge
- Task card: surface background, border, 8px radius, 16px padding
- Priority badge colors: urgent → danger, high → #F76B15, medium → warning, low → text-tertiary
- Drag handle: subtle, appears on hover

**Acceptance Criteria:**
- [ ] 5 columns rendered with correct task counts
- [ ] Task cards show: short_id, title, priority badge, deadline (if set), assignee avatar/initials
- [ ] Drag-and-drop moves card between columns, calls PATCH status API
- [ ] Optimistic UI update (card moves immediately, reverts on error)
- [ ] Mobile: horizontal scrollable columns or tab navigation
- [ ] Empty column shows placeholder text
- [ ] "Add task" button visible (opens creation dialog)
- [ ] All styles match design-brief.md

**Verification:** Drag task from "New" to "In Progress" → card moves → API called → status updated

---

### Task 8 (#18): Frontend — Task creation/edit dialog
**Description:** Modal dialog for creating and editing tasks. Form fields: title, description (textarea), priority (select), deadline (date picker), checklist editor, assignee (admin only).

**Files:**
- `frontend/src/components/tasks/task-dialog.tsx` — create/edit dialog
- `frontend/src/components/tasks/checklist-editor.tsx` — checklist add/edit/toggle
- Install additional shadcn/ui components: dialog, select, textarea, popover, calendar

**Acceptance Criteria:**
- [ ] Create mode: empty form, "Create Task" button
- [ ] Edit mode: pre-filled form, "Save Changes" button
- [ ] Title is required, other fields optional
- [ ] Priority select: urgent, high, medium, low (with color indicators)
- [ ] Deadline: date picker (shadcn calendar)
- [ ] Checklist: add items, edit text, toggle completion, remove items
- [ ] Assignee dropdown: only shown for admin, lists all users
- [ ] Form validation with error messages
- [ ] Closes on success, refreshes kanban board

**Verification:** Open dialog → fill form → create → task appears on board; edit existing → changes saved

---

### Task 9 (#19): Frontend — Task detail page + timeline
**Description:** Task detail page at `/tasks/[id]` showing full task info, checklist with toggle, and updates timeline. Add comment/update form.

**Files:**
- `frontend/src/app/(dashboard)/tasks/[id]/page.tsx` — detail page
- `frontend/src/components/tasks/task-detail.tsx` — detail view component
- `frontend/src/components/tasks/task-timeline.tsx` — updates timeline
- `frontend/src/components/tasks/checklist-view.tsx` — interactive checklist

**Layout:**
- Left/main: task info (title, description, checklist)
- Right sidebar or below: metadata (status, priority, assignee, dates)
- Bottom: timeline of updates

**Acceptance Criteria:**
- [ ] Shows all task fields: title, description, status, priority, deadline, assignee, creator, dates
- [ ] Checklist items can be toggled (calls PATCH API)
- [ ] Timeline shows all updates with type icons, author, timestamp
- [ ] Comment form at bottom of timeline
- [ ] Edit button opens task-dialog in edit mode
- [ ] Back button returns to kanban board
- [ ] Status badge with appropriate color
- [ ] Priority badge with appropriate color
- [ ] Responsive layout

**Verification:** Navigate to task detail → see all info → toggle checklist item → add comment → appears in timeline

---

### Task 10 (#20): Frontend — Task filters bar
**Description:** Filter bar above the Kanban board for filtering tasks by status, priority, assignee, search text, and deadline range.

**Files:**
- `frontend/src/components/tasks/task-filters.tsx` — filter bar component
- `frontend/src/app/(dashboard)/tasks/page.tsx` — integrate filters

**Filters:**
- Search input (debounced, searches title + description)
- Priority multi-select (checkboxes)
- Assignee dropdown
- Deadline range (before/after date pickers)
- Active filter count badge
- "Clear filters" button

**Acceptance Criteria:**
- [ ] Search input filters tasks in real-time (debounced 300ms)
- [ ] Priority filter: select one or more priorities
- [ ] Assignee filter: dropdown with users list
- [ ] Filters are passed as query params to API
- [ ] Active filters shown as removable chips/badges
- [ ] "Clear all" resets to default view
- [ ] Filters persist during session (URL query params or state)
- [ ] Kanban board updates when filters change

**Verification:** Type in search → board filters; select priority → matching tasks shown; clear → all tasks shown

---

## Task Dependencies

```
Task 1 (DB schema)
  ├─ Task 2 (CRUD API)
  │    ├─ Task 3 (List + Kanban API)
  │    └─ Task 4 (Updates API)
  │         └─ Task 5 (Assignment + ACL)
  │
  └─ (frontend, after Task 3+4+5)
     Task 6 (TanStack Query + types + hooks)
       ├─ Task 7 (Kanban board + DnD)
       │    ├─ Task 8 (Create/edit dialog)
       │    └─ Task 10 (Filters bar)
       └─ Task 9 (Detail page + timeline)
```

## Execution Order
1. Task 1 (DB schema)
2. Task 2 (CRUD API)
3. Task 3 + Task 4 (parallel — independent API extensions)
4. Task 5 (Assignment — builds on CRUD)
5. Task 6 (Frontend setup — needs all APIs ready)
6. Task 7 (Kanban board)
7. Task 8 + Task 9 (parallel — dialog and detail page are independent)
8. Task 10 (Filters — needs kanban board)
