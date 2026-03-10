# PRD: Task Card Inline Editing & Kanban Cleanup

## Metadata
| Field | Value |
|-------|-------|
| Author | Dmitry |
| Date | 2026-03-10 |
| Status | Approved |
| Priority | P0 |

## Problem Statement
Currently, editing a task requires opening a separate TaskDialog modal, creating an extra navigation step. The Job detail card already supports inline editing (pencil icons, click-to-edit fields). The same pattern should be applied to the Task detail card so that all fields — including the checklist — are editable directly on the card without leaving the page.

Additionally, the Kanban board has two outdated UI artifacts: the task title darkens on hover (unnecessary visual noise), and drag-handle dots are shown even though the entire card is now draggable.

## User Scenarios
### Scenario 1: Inline Task Editing
**As a** user, **I want to** edit any task field directly on the task detail card, **so that** I don't have to open a separate edit dialog.

### Scenario 2: Inline Checklist Management
**As a** user, **I want to** add, edit, toggle, and remove checklist items directly on the task detail card, **so that** I can manage my checklist without navigating away.

### Scenario 3: Clean Kanban Cards
**As a** user, **I want** Kanban cards without visual clutter (no hover darkening on title, no drag-handle dots), **so that** the board looks clean and modern.

## Functional Requirements

### P0 (Must Have)

- [ ] FR-1: Title — inline editable via `InlineEditText` (click pencil → input → Enter/Escape)
- [ ] FR-2: Description — inline editable via `CollapsibleDescription` (same pattern as Job card)
- [ ] FR-3: Priority — inline editable via dropdown selector with pencil icon
- [ ] FR-4: Visibility — inline editable via dropdown selector with pencil icon
- [ ] FR-5: Deadline — inline editable via DatePicker with pencil icon
- [ ] FR-6: Reminder — inline editable via DateTimePicker with pencil icon
- [ ] FR-7: Checklist — always visible on card, editable inline (add/toggle/edit/delete items)
- [ ] FR-8: Checklist collapsible when more than 5 items (show first 5, "Show N more" toggle)
- [ ] FR-9: Remove "Edit" button from task detail card (no more TaskDialog for editing)
- [ ] FR-10: TaskDialog remains only for task creation (mode="create" only)
- [ ] FR-11: Kanban card title — remove hover color change (no darkening on mouseover)
- [ ] FR-12: Kanban card — remove drag-handle dots (6 dots / grip icon)

## Non-Functional Requirements
- All inline edits should save immediately via API (same pattern as Job card)
- Toast notification on successful save
- No full-page reload on save
- Responsive layout preserved

## Technical Design

### Stack
- Reuse existing inline edit components from `job-detail.tsx`: `InlineEditText`, `CollapsibleDescription`
- Create new inline edit components as needed: `InlineEditSelect` for Priority/Visibility dropdowns
- Adapt `ChecklistEditor` for always-visible inline use on task detail card
- Modify `TaskCard` component to remove drag handle and title hover styles

### Architecture
1. **Task detail page** (`tasks/[id]/page.tsx`): Replace read-only fields + edit button with inline edit components. Add checklist section with collapsible behavior.
2. **Inline edit components**: Extract shared components from `job-detail.tsx` into reusable files (or import directly if already extracted).
3. **TaskDialog**: Remove edit mode support, keep create mode only.
4. **TaskCard**: CSS-only changes to remove hover effect and drag handle dots.

### API
- No backend changes needed — existing `PATCH /tasks/{id}` endpoint supports all field updates via `UpdateTaskInput`.

## Out of Scope
- Assignee inline editing (requires user picker component — future work)
- Status inline editing on detail card (already works via dropdown)
- Reordering checklist items via drag-and-drop

## Acceptance Criteria
- [ ] AC-1: All task fields (title, description, priority, visibility, deadline, reminder, checklist) are editable inline on the task detail card
- [ ] AC-2: No separate edit dialog/modal opens when editing a task
- [ ] AC-3: TaskDialog works only for creating new tasks
- [ ] AC-4: Checklist is always visible on the task detail card and collapses when >5 items
- [ ] AC-5: Kanban card title does not change color on hover
- [ ] AC-6: Kanban card has no drag-handle dots
- [ ] AC-7: All changes save immediately via API with toast feedback

## Open Questions
- None
