# PRD: Backlog Status for Kanban Board

## Metadata
| Field | Value |
|-------|-------|
| Author | Dmitry |
| Date | 2026-03-11 |
| Status | Approved |
| Priority | P1 |

## Problem Statement

The "New" column on the Kanban board currently serves two purposes: it holds both tasks that are ready to be started soon and rough ideas/wishes that may never be acted on. This creates a cluttered "New" column where actionable tasks are mixed with vague intentions, making it hard to focus on what needs to be done next.

A dedicated `backlog` status is needed to separate "someday/maybe" items from "ready to start" tasks.

## Semantic Meaning of Statuses (after change)

| Status | Meaning |
|--------|---------|
| `backlog` | "Someday / maybe" — captured ideas, wishes, things to consider. No commitment to start. |
| `new` | "Ready to start" — concrete, actionable tasks I intend to begin soon. |
| `in_progress` | "Working on it" — actively in progress. |
| `review` | "Waiting for confirmation" — done from my side, pending external input. |
| `done` | "Completed" — finished work. |
| `cancelled` | "Dropped" — decided not to do. |

## User Scenarios

### Scenario 1: Capture an Idea Quickly
**As a** user, **I want to** create a task in Backlog status, **so that** I can capture a thought without polluting my "ready to start" queue.

### Scenario 2: Promote to Actionable
**As a** user, **I want to** drag a task from Backlog to New, **so that** I signal it's now something I'm committing to do soon.

### Scenario 3: Focused New Column
**As a** user, **I want** the New column to contain only tasks I plan to start shortly, **so that** I can clearly see my immediate work queue.

## Functional Requirements

### P0 (Must Have)

#### FR-1: New `backlog` TaskStatus
- [ ] FR-1.1: Add `backlog` to `TaskStatus` enum in backend (`models/task.py`)
- [ ] FR-1.2: Alembic migration to add `backlog` value to the PostgreSQL `taskstatus` enum
- [ ] FR-1.3: Add `backlog` to frontend `TaskStatus` type (`types/task.ts`)
- [ ] FR-1.4: Add to `TASK_STATUS_LABELS`: `backlog → "Backlog"`
- [ ] FR-1.5: Add to `TASK_STATUS_ORDER` as the **first** element: `["backlog", "new", "in_progress", "review", "done", "cancelled"]`

#### FR-2: Kanban Column Configuration
- [ ] FR-2.1: Backlog column is **visible by default** (NOT in `kanban_hidden_columns`)
- [ ] FR-2.2: Default hidden columns remain: `["review", "cancelled"]`
- [ ] FR-2.3: Backlog column uses a distinct accent color — `var(--accent-violet)` (purple) to visually distinguish it from New
- [ ] FR-2.4: Default board view shows 4 columns: Backlog → New → In Progress → Done

#### FR-3: Task Creation Default
- [ ] FR-3.1: When creating a task via "+ New Task" button, default status remains `new` (no change)
- [ ] FR-3.2: User can select `backlog` as status in the task creation dialog

#### FR-4: Drag & Drop Support
- [ ] FR-4.1: Tasks can be dragged from Backlog to any visible column (and vice versa)
- [ ] FR-4.2: Standard drag-and-drop behavior — no special rules for Backlog

#### FR-5: Done Column Collapse Applies Same Way
- [ ] FR-5.1: Backlog column does NOT have a card limit (unlike Done with its 10-card limit) — all backlog tasks are visible
- [ ] FR-5.2: If Backlog grows large in the future, the same "Show more/less" pattern from Done can be applied (out of scope for now)

### P1 (Nice to Have)

- [ ] FR-6: Quick action on task card context menu: "Move to Backlog" / "Move to New"
- [ ] FR-7: Filter bar: ability to filter by status (show only Backlog tasks in a list view)

## Non-Functional Requirements

- Adding a new enum value to PostgreSQL must be done via `ALTER TYPE ... ADD VALUE` (not recreate) — this is non-reversible but safe
- No data migration needed — existing tasks stay in their current statuses
- No breaking changes to API — `backlog` is simply a new valid value for the `status` field

## Technical Design

### Backend Changes

#### 1. Model (`models/task.py`)
Add `backlog` as the first value in `TaskStatus` enum:
```python
class TaskStatus(str, enum.Enum):
    backlog = "backlog"
    new = "new"
    in_progress = "in_progress"
    review = "review"
    done = "done"
    cancelled = "cancelled"
```

#### 2. Schema (`schemas/task.py`)
Add `backlog` to `KanbanBoard` response model:
```python
class KanbanBoard(BaseModel):
    backlog: list[TaskResponse] = []
    new: list[TaskResponse] = []
    in_progress: list[TaskResponse] = []
    review: list[TaskResponse] = []
    done: list[TaskResponse] = []
    cancelled: list[TaskResponse] = []
```

#### 3. Service (`services/task.py`)
Update `get_kanban_board` to include `backlog` column in the returned dict.

#### 4. Alembic Migration
```python
def upgrade():
    op.execute("ALTER TYPE taskstatus ADD VALUE 'backlog' BEFORE 'new'")

def downgrade():
    # PostgreSQL enum value removal is complex — skip for personal project
    pass
```

### Frontend Changes

#### 1. Types (`types/task.ts`)
```typescript
export type TaskStatus = "backlog" | "new" | "in_progress" | "review" | "done" | "cancelled";

export const TASK_STATUS_ORDER: TaskStatus[] = [
  "backlog", "new", "in_progress", "review", "done", "cancelled",
];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: "Backlog",
  new: "New",
  // ... rest unchanged
};
```

#### 2. Kanban Board (`kanban-board.tsx`)
Add `backlog` to `KanbanBoardType` interface and `EMPTY_BOARD` constant.

#### 3. Kanban Column (`kanban-column.tsx`)
Add accent color for backlog:
```typescript
const STATUS_ACCENT: Record<TaskStatus, string> = {
  backlog: "bg-[var(--accent-violet)]",
  // ... rest unchanged
};
```

#### 4. Tasks Page (`page.tsx`)
Update `EMPTY_BOARD` to include `backlog: []`.

#### 5. Task Dialog (`task-dialog.tsx`)
Ensure `backlog` is available as a status option when creating/editing a task.

## Out of Scope
- Card limit / "Show more" for Backlog column (apply later if needed)
- Bulk move from Backlog to New
- Separate Backlog view/page outside of Kanban
- Auto-sorting within Backlog (e.g., by priority)

## Acceptance Criteria
- [ ] AC-1: `backlog` is a valid task status in both backend and frontend
- [ ] AC-2: Kanban board shows Backlog as the first (leftmost) column
- [ ] AC-3: Backlog column is visible by default (not hidden)
- [ ] AC-4: Default visible columns are: Backlog, New, In Progress, Done
- [ ] AC-5: Tasks can be dragged between Backlog and other columns
- [ ] AC-6: New task creation defaults to `new` status, with `backlog` available as an option
- [ ] AC-7: Backlog column has purple accent color (`var(--accent-violet)`)
- [ ] AC-8: Existing tasks are unaffected — no data migration required
- [ ] AC-9: PostgreSQL enum is extended without breaking existing data

## Open Questions
- None
