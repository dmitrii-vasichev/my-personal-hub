# Phase 22: Task Inline Editing & Kanban Cleanup

## Overview
Move all task editing from a separate TaskDialog modal into inline editing on the task detail card. Clean up Kanban board by removing outdated drag handle and title hover effect.

## Tasks

### Task 1: Extract shared inline edit components from job-detail.tsx
**Description:** Move `InlineEditText`, `InlineEditTags`, `CollapsibleDescription`, and `InlineEditSalary` from `components/jobs/job-detail.tsx` into separate reusable files under `components/ui/`. Update job-detail.tsx imports.

**Files:**
- `frontend/src/components/ui/inline-edit-text.tsx` (new)
- `frontend/src/components/ui/inline-edit-tags.tsx` (new)
- `frontend/src/components/ui/collapsible-description.tsx` (new)
- `frontend/src/components/ui/inline-edit-salary.tsx` (new)
- `frontend/src/components/jobs/job-detail.tsx` (update imports)

**Acceptance Criteria:**
- [ ] All 4 inline edit components extracted into separate files
- [ ] job-detail.tsx imports from new files and works identically
- [ ] No visual or functional regression on job detail card
- [ ] Build passes

### Task 2: Create InlineEditSelect component for dropdown fields
**Description:** Create a reusable inline edit select component for fields like Priority and Visibility. Shows current value with pencil icon, click to open dropdown, select to save immediately.

**Files:**
- `frontend/src/components/ui/inline-edit-select.tsx` (new)

**Acceptance Criteria:**
- [ ] Component renders current value with pencil icon on hover
- [ ] Click opens dropdown with options
- [ ] Selecting an option saves immediately via callback
- [ ] Escape closes dropdown without saving
- [ ] Supports custom label/color rendering per option

### Task 3: Create InlineEditDate component for date/datetime fields
**Description:** Create a reusable inline edit date component wrapping existing DatePicker/DateTimePicker. Shows formatted date with pencil icon, click to open picker.

**Files:**
- `frontend/src/components/ui/inline-edit-date.tsx` (new)

**Acceptance Criteria:**
- [ ] Component renders formatted date with pencil icon on hover
- [ ] Click opens DatePicker (or DateTimePicker for datetime mode)
- [ ] Selecting date saves immediately via callback
- [ ] Shows placeholder when no date set
- [ ] Supports clearing the date

### Task 4: Rebuild task detail page with inline editing
**Description:** Replace the read-only task detail page with inline editable fields. Add all fields from TaskDialog directly to the card. Remove the "Edit" button.

**Fields to make inline-editable:**
- Title → `InlineEditText`
- Description → `CollapsibleDescription`
- Priority → `InlineEditSelect` (with priority colors)
- Visibility → `InlineEditSelect`
- Deadline → `InlineEditDate`
- Reminder → `InlineEditDate` (datetime mode)

**Files:**
- `frontend/src/app/(dashboard)/tasks/[id]/page.tsx` (rewrite)

**Acceptance Criteria:**
- [ ] All 6 fields are inline editable with pencil icons
- [ ] Each field saves immediately via PATCH API
- [ ] Toast notification on successful save
- [ ] "Edit" button removed from header
- [ ] Status dropdown remains as-is (already inline)
- [ ] Build passes

### Task 5: Add inline checklist section to task detail page
**Description:** Add a checklist section directly on the task detail card. Reuse/adapt ChecklistEditor for inline use. Implement collapsible behavior when >5 items.

**Files:**
- `frontend/src/app/(dashboard)/tasks/[id]/page.tsx` (update)
- `frontend/src/components/tasks/checklist-editor.tsx` (may need minor adjustments)

**Acceptance Criteria:**
- [ ] Checklist section visible on task detail card
- [ ] Can add new checklist items inline
- [ ] Can toggle, edit text, and delete items
- [ ] When >5 items, shows first 5 with "Show N more" toggle
- [ ] Changes save immediately via PATCH API
- [ ] Empty checklist shows "Add checklist item" prompt

### Task 6: Remove edit mode from TaskDialog
**Description:** Clean up TaskDialog to only support create mode. Remove all edit-mode logic and references.

**Files:**
- `frontend/src/components/tasks/task-dialog.tsx` (simplify)
- `frontend/src/app/(dashboard)/tasks/[id]/page.tsx` (remove TaskDialog import for editing)
- `frontend/src/app/(dashboard)/tasks/page.tsx` (verify create-only usage)

**Acceptance Criteria:**
- [ ] TaskDialog only accepts mode="create"
- [ ] No edit-mode code paths remain
- [ ] Task creation still works from Kanban page
- [ ] Build passes

### Task 7: Kanban card cleanup — remove title hover and drag handle
**Description:** Remove the title hover color change effect and the 6-dot drag handle from the Kanban task card.

**Files:**
- `frontend/src/components/tasks/task-card.tsx` (update)

**Acceptance Criteria:**
- [ ] Task title does not change color/opacity on hover
- [ ] No drag-handle dots (grip icon) visible on the card
- [ ] Card is still draggable by any area (existing behavior)
- [ ] No visual regression on other card elements

## Dependency Order
```
Task 1 (extract components)
  ├── Task 2 (InlineEditSelect) — can run in parallel
  ├── Task 3 (InlineEditDate) — can run in parallel
  │
  └── Task 4 (rebuild detail page) — depends on 1, 2, 3
        └── Task 5 (checklist section) — depends on 4
              └── Task 6 (remove edit mode) — depends on 4, 5

Task 7 (Kanban cleanup) — independent, can run anytime
```

## Verification
- `npm run build` — no build errors
- `npm run lint` — no new lint errors
- Manual: open task detail, edit each field inline, verify save
- Manual: open Kanban, verify no hover/dots, drag still works
