# PRD: Kanban Inline Task Creation

## Problem

Currently, creating a task on the Kanban board requires clicking "New Task" in the top-right corner, which always defaults to "New" status. When a user wants to add a task directly to a specific column (e.g., Backlog, Done), they must:
1. Click the global "New Task" button
2. Manually change the status in the dialog dropdown

This is especially inconvenient for quick task logging — for example, when something was already done but needs to be recorded ("I just did this, let me log it in Done"), or when triaging directly into Backlog.

## Solution

Add a "+" button to each Kanban column header. Clicking it opens the existing TaskDialog with the status pre-selected to match that column.

## Requirements

### R1: Add "+" button to column headers
- Each column header (Backlog, New, In Progress, Review, Done, Cancelled) gets a small "+" icon button
- Position: in the header row, after the task count badge (right side)
- Style: subtle, ghost-style button matching the design system (like existing icon buttons)
- Icon: Plus icon from lucide-react (already used in the project)

### R2: TaskDialog accepts optional initial status
- Add an optional `initialStatus` prop to `TaskDialog`
- When provided, the status dropdown defaults to this value instead of "new"
- The status dropdown should show all statuses available for creation (currently "new" and "backlog", but when opened from a column, it should show all statuses)
- User can still change the status in the dialog if needed

### R3: Column-level state management
- `KanbanColumn` emits an event/callback when "+" is clicked, passing the column's status
- `KanbanBoard` or the parent page handles opening the dialog with the correct initial status
- After task creation, the board refreshes as it does now

## Out of Scope
- Inline editing (typing task title directly in the column without a dialog)
- Quick-add mode (single-field creation)

## Design Notes
- The "+" button should be visually subtle to not clutter the column header
- On hover, it should become more visible (opacity or background change)
- Should follow the existing design brief guidelines

## Phases
This is a single-phase feature (Phase 27).
