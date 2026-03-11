# Phase 27: Kanban Inline Task Creation

## Overview
Add a "+" button to each Kanban column header that opens the task creation dialog with the column's status pre-selected.

## Tasks

### Task 1: Add `initialStatus` prop to TaskDialog
**File:** `frontend/src/components/tasks/task-dialog.tsx`
- Add optional `initialStatus?: TaskStatus` prop to `TaskDialogProps`
- Use `initialStatus ?? "new"` as default value for the `status` state
- Expand the status dropdown to show all statuses from `TASK_STATUS_ORDER` (not just "new" and "backlog") so users can create tasks in any status
- Fix status submission logic: currently skips sending status when it's "new" — should always send when `initialStatus` is provided

### Task 2: Add `onAddTask` callback to KanbanColumn
**File:** `frontend/src/components/tasks/kanban-column.tsx`
- Add optional `onAddTask?: () => void` prop to `KanbanColumnProps`
- Add a small "+" icon button in the column header, after the task count badge
- Style: ghost button, subtle opacity, more visible on hover
- On click: call `onAddTask()`

### Task 3: Wire up KanbanBoard to pass `onAddTask` to columns
**File:** `frontend/src/components/tasks/kanban-board.tsx`
- Add `onAddTask?: (status: TaskStatus) => void` prop to `KanbanBoardProps`
- Pass `onAddTask={() => onAddTask?.(status)}` to each `KanbanColumn`

### Task 4: Connect TasksPage to handle column "+" clicks
**File:** `frontend/src/app/(dashboard)/tasks/page.tsx`
- Replace `showCreateDialog` boolean with `createDialogStatus: TaskStatus | null` (null = closed)
- "New Task" header button sets `createDialogStatus` to `"new"`
- `onAddTask` from KanbanBoard sets `createDialogStatus` to the clicked column's status
- Pass `initialStatus={createDialogStatus}` to TaskDialog

### Task 5: Tests
**File:** `frontend/src/components/tasks/__tests__/kanban-column.test.tsx` (new)
- Test: "+" button renders in column header
- Test: clicking "+" calls `onAddTask` callback
**File:** `frontend/src/components/tasks/__tests__/task-dialog.test.tsx` (update existing or new)
- Test: dialog defaults to "new" when no `initialStatus`
- Test: dialog defaults to provided `initialStatus` (e.g., "backlog", "done")

## Affected Files
1. `frontend/src/components/tasks/task-dialog.tsx` — add prop
2. `frontend/src/components/tasks/kanban-column.tsx` — add button + callback
3. `frontend/src/components/tasks/kanban-board.tsx` — pass through callback
4. `frontend/src/app/(dashboard)/tasks/page.tsx` — wire state
5. `frontend/src/components/tasks/__tests__/kanban-column.test.tsx` — new tests
6. `frontend/src/components/tasks/__tests__/task-dialog.test.tsx` — new/update tests
