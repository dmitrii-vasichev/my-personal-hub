# PRD: Kanban Board UX Improvements

## Metadata
| Field | Value |
|-------|-------|
| Author | Dmitry |
| Date | 2026-03-11 |
| Status | Approved |
| Priority | P1 |

## Problem Statement

The Kanban board in the Tasks module has several UX issues that reduce usability as the number of tasks grows:

1. **Horizontal overflow** — all 5 status columns (new, in_progress, review, done, cancelled) are always rendered, causing horizontal scroll even when some columns are empty or irrelevant (cancelled, review).
2. **Done column accumulation** — completed tasks pile up indefinitely in the Done column, creating excessive vertical scroll and visual noise.
3. **Visual clutter on task cards** — priority is displayed as both a colored dot AND text label ("medium", "low"), taking up a dedicated header row on every card.
4. **Unnecessary deadline filter** — the "Due before" date picker in the filter bar is rarely used since most tasks don't have strict deadlines.

## User Scenarios

### Scenario 1: Focused Board View
**As a** user, **I want to** hide columns I don't use (cancelled, review), **so that** the board fits on screen without horizontal scrolling and I can focus on active work.

### Scenario 2: Clean Done Column
**As a** user, **I want to** see only the last 10 completed tasks in the Done column with the ability to expand, **so that** the board stays compact as tasks accumulate over time.

### Scenario 3: Scannable Priority
**As a** user, **I want to** identify task priority at a glance by a colored left border on the card, **so that** the card content stays clean and focused on the task title.

### Scenario 4: Simpler Filters
**As a** user, **I want** only essential filters (search + priority), **so that** the filter bar is compact and easy to use.

## Functional Requirements

### P0 (Must Have)

#### FR-1: Configurable Column Visibility
- [ ] FR-1.1: Add a "Columns" button (icon: `Columns3` or `SlidersHorizontal` from Lucide) in the filter bar area
- [ ] FR-1.2: Clicking the button opens a dropdown/popover with checkboxes for each status column
- [ ] FR-1.3: Default visible columns: `new`, `in_progress`, `done`
- [ ] FR-1.4: Default hidden columns: `review`, `cancelled`
- [ ] FR-1.5: At least 2 columns must remain visible (prevent hiding all)
- [ ] FR-1.6: Hidden columns' tasks are still accessible via search, task list, and direct URL
- [ ] FR-1.7: Column visibility preferences are persisted in UserSettings via API (survives sessions, devices)

#### FR-2: Done Column Collapse (Show More/Less)
- [ ] FR-2.1: Done column shows only the **last 10** completed tasks by default (sorted by `completed_at` DESC)
- [ ] FR-2.2: If more than 10 tasks exist in Done, show a "Show all (N)" button at the bottom of the column
- [ ] FR-2.3: Clicking "Show all" expands to display all Done tasks
- [ ] FR-2.4: When expanded, the button changes to "Show less" to collapse back to 10
- [ ] FR-2.5: Collapse state resets on page reload (always starts collapsed)

#### FR-3: Priority — Colored Left Border
- [ ] FR-3.1: Remove the text priority label ("medium", "low", etc.) from the task card
- [ ] FR-3.2: Remove the priority dot from the task card header row
- [ ] FR-3.3: Add a 3px left border to the task card with the priority color:
  - `urgent` → `var(--danger)` (red)
  - `high` → `var(--accent-amber)` (amber/orange)
  - `medium` → `var(--accent)` (blue)
  - `low` → `var(--text-tertiary)` (gray)
- [ ] FR-3.4: Priority tooltip on hover over the left border (optional, nice-to-have)
- [ ] FR-3.5: Drag overlay card also uses the same left border style

#### FR-4: Remove Deadline Filter
- [ ] FR-4.1: Remove the "Due before" DatePicker from `TaskFiltersBar`
- [ ] FR-4.2: Remove `deadline_before` and `deadline_after` from `TaskFilters` type (frontend)
- [ ] FR-4.3: Keep the deadline display on the task card (calendar icon + date) — no changes there
- [ ] FR-4.4: Backend API continues to support `deadline_before`/`deadline_after` query params (no breaking change)

### P1 (Nice to Have)

- [ ] FR-5: Sort tasks within each column: tasks with upcoming deadlines float to the top, then by `created_at` DESC
- [ ] FR-6: Badge on the "Columns" button showing count of hidden columns (e.g., "2 hidden")
- [ ] FR-7: Keyboard shortcut to toggle column visibility (e.g., `Ctrl+Shift+1..5`)

## Non-Functional Requirements

- Column visibility changes should reflect instantly (no loading spinner)
- UserSettings API call for saving column preferences should be debounced (500ms) to avoid excessive requests when toggling multiple columns
- No layout shift when columns appear/disappear (smooth transition preferred)
- All changes must work in both dark and light themes
- Mobile: column selector dropdown must be touch-friendly

## Technical Design

### Backend Changes

#### UserSettings Model — New Field
Add a JSON column to `UserSettings` for storing kanban preferences:

```python
# models/settings.py
kanban_hidden_columns: Mapped[list] = mapped_column(
    JSON, default=list, nullable=False, server_default="[]"
)
```

Values: list of `TaskStatus` strings, e.g. `["review", "cancelled"]`

#### Schema Changes
```python
# schemas/settings.py — SettingsUpdate
kanban_hidden_columns: Optional[list[str]] = None

# schemas/settings.py — SettingsResponse
kanban_hidden_columns: list[str]
```

#### Migration
- Alembic migration: add `kanban_hidden_columns` column with default `[]`

#### API
- No new endpoints — reuse existing `PATCH /api/settings` and `GET /api/settings`

### Frontend Changes

#### 1. Types (`types/task.ts`)
- Remove `deadline_before`, `deadline_after` from `TaskFilters` interface
- Add `DEFAULT_HIDDEN_COLUMNS: TaskStatus[] = ["review", "cancelled"]`

#### 2. Filter Bar (`components/tasks/task-filters.tsx`)
- Remove DatePicker and "Due before" label
- Add "Columns" button with popover containing checkboxes for each status
- Fetch current hidden columns from UserSettings on mount
- On toggle: update local state immediately, debounced PATCH to `/api/settings`

#### 3. Kanban Board (`components/tasks/kanban-board.tsx`)
- Accept `hiddenColumns: TaskStatus[]` prop
- Filter `TASK_STATUS_ORDER` to exclude hidden columns before `.map()`
- Pass filtered list to rendering

#### 4. Kanban Column (`components/tasks/kanban-column.tsx`)
- Accept `collapsedLimit?: number` prop
- For `done` status: show only first N tasks, render "Show all (total)" / "Show less" toggle
- Use local `useState` for expanded/collapsed

#### 5. Task Card (`components/tasks/task-card.tsx`)
- Remove priority badge section (dot + text) from the card header
- Add `border-l-[3px]` with color based on `task.priority` using a mapping constant
- Remove the entire header row if only visibility icon remains — move it to footer or inline with title
- Update `TaskCardOverlay` similarly

#### 6. Tasks Page (`app/(dashboard)/tasks/page.tsx`)
- Wire up hidden columns state from settings
- Remove deadline filter params from `useKanbanTasks` call

### Component Hierarchy (after changes)
```
TasksPage
├── TaskFiltersBar (search + priority + columns-button)
├── KanbanBoard (receives hiddenColumns)
│   └── KanbanColumn × N (filtered)
│       ├── TaskCard × M (with colored left border)
│       └── "Show all (47)" button (done column only)
└── TaskDialog (create mode)
```

## Out of Scope
- Auto-archiving old Done tasks (moving to a separate "archived" status in DB)
- Drag-and-drop column reordering
- Per-column WIP limits
- Column renaming or custom statuses
- Task sorting UI (manual sort control dropdown)

## Migration & Rollout
1. Backend: Alembic migration adds `kanban_hidden_columns` to `user_settings`
2. Frontend: Deploy all UI changes together
3. Default experience: review + cancelled hidden, no migration of existing user preferences needed (empty array = use frontend defaults)

## Acceptance Criteria
- [ ] AC-1: Only `new`, `in_progress`, `done` columns are visible by default
- [ ] AC-2: "Columns" dropdown lets user toggle visibility of any column
- [ ] AC-3: Column visibility persists across page reloads and devices (saved in UserSettings)
- [ ] AC-4: Done column shows max 10 tasks with "Show all (N)" expand button
- [ ] AC-5: Task cards have a colored left border indicating priority (no text label)
- [ ] AC-6: "Due before" date picker is removed from the filter bar
- [ ] AC-7: Drag-and-drop still works correctly with hidden columns (task dropped on visible column only)
- [ ] AC-8: Horizontal scroll is eliminated when using default column configuration
- [ ] AC-9: Both dark and light themes render the priority border colors correctly

## Open Questions
- None
