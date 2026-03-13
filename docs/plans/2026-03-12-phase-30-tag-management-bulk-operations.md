# Phase 30: Tag Management & Bulk Operations (Frontend)

**PRD:** docs/prd-task-tags.md (Phase 3)
**Date:** 2026-03-12
**Scope:** FR-10 (Tag Management in Settings), FR-11 (Bulk Tag Assignment UI)
**Dependencies:** Phase 28 (backend) ✅, Phase 29 (frontend core) ✅

---

## Task 1: Tags Management Tab Component

**Description:** Create `TagsManagementTab` component for the Settings page. Display all user tags as a list with color swatch, name, and task count. Show current count vs limit (N/20).

**Files:**
- `frontend/src/components/settings/tags-management-tab.tsx` (new)

**Acceptance Criteria:**
- [ ] Component renders a list of all user's tags
- [ ] Each tag row shows: color swatch, name, task count ("Portal — 12 tasks")
- [ ] Shows "N / 20 tags" counter at the top
- [ ] Empty state when no tags exist
- [ ] Uses `useTags()` hook for data

**Verification:** Visual check in Settings page; component renders without errors.

---

## Task 2: Integrate Tags Tab into Settings Page

**Description:** Add "Tags" tab to the Settings page tab list. Import and render `TagsManagementTab` when the tab is active. Tags tab is available to all users (not admin-only, since tags are per-user).

**Files:**
- `frontend/src/app/(dashboard)/settings/page.tsx` (modify)

**Acceptance Criteria:**
- [ ] "Tags" tab visible in the Settings page for all users
- [ ] Clicking "Tags" tab renders `TagsManagementTab`
- [ ] Other tabs still work as before

**Verification:** Navigate to Settings, click "Tags" tab — tag list appears.

---

## Task 3: Inline Tag Creation in Settings

**Description:** Add "Create tag" button at the top of TagsManagementTab. Opens an inline row with name input + color preset picker. Submits via `useCreateTag()`. Disables button when at 20-tag limit.

**Files:**
- `frontend/src/components/settings/tags-management-tab.tsx` (modify)

**Acceptance Criteria:**
- [ ] "Create tag" button visible at the top
- [ ] Clicking opens inline form with name input + color swatches
- [ ] Enter submits, Escape cancels
- [ ] After creation, list updates automatically
- [ ] Button disabled with tooltip when at 20-tag limit
- [ ] Error toast on duplicate name

**Verification:** Create a new tag from Settings → Tags; verify it appears in list and on task tag picker.

---

## Task 4: Inline Tag Edit (Rename & Recolor)

**Description:** Click tag name to enter edit mode (inline input). Click color swatch to open color preset picker. Changes saved via `useUpdateTag()`.

**Files:**
- `frontend/src/components/settings/tags-management-tab.tsx` (modify)

**Acceptance Criteria:**
- [ ] Clicking tag name switches to editable input
- [ ] Enter saves, Escape reverts
- [ ] Clicking color swatch opens preset color picker
- [ ] Selecting new color saves immediately
- [ ] Tag list refreshes after edit
- [ ] Duplicate name shows error toast

**Verification:** Rename a tag and change its color from Settings; verify changes reflect on task cards.

---

## Task 5: Tag Delete with Confirmation

**Description:** Add delete button to each tag row. Clicking shows a confirmation dialog: "Delete tag 'Portal'? It will be removed from 12 tasks. Tasks themselves won't be deleted." Uses `useDeleteTag()`.

**Files:**
- `frontend/src/components/settings/tags-management-tab.tsx` (modify)

**Acceptance Criteria:**
- [ ] Delete (trash) icon on each tag row
- [ ] Confirmation dialog shows tag name and affected task count
- [ ] After deletion, tag list updates
- [ ] Tasks that had the tag lose it (backend cascade handles this)
- [ ] Success toast after deletion

**Verification:** Delete a tag from Settings; verify it disappears from task cards and filters.

---

## Task 6: Kanban Multi-Select Mode

**Description:** Add checkbox to each TaskCard for multi-select. Track selected task IDs at board level. Clicking checkbox toggles selection without navigating to task detail.

**Files:**
- `frontend/src/components/tasks/task-card.tsx` (modify)
- `frontend/src/components/tasks/kanban-board.tsx` (modify)
- `frontend/src/components/tasks/kanban-column.tsx` (modify)

**Acceptance Criteria:**
- [ ] Checkbox appears on hover (top-left corner of card)
- [ ] Clicking checkbox toggles task selection
- [ ] Selected cards have a highlighted border/background
- [ ] Checkbox click does NOT navigate to task detail
- [ ] Selection state managed at KanbanBoard level
- [ ] Dragging is still functional (drag handle vs checkbox area)

**Verification:** Hover over cards to see checkbox; click to select multiple cards across columns.

---

## Task 7: Bulk Action Toolbar

**Description:** When 1+ tasks are selected, show a floating action bar at the bottom of the Kanban board. Shows "N tasks selected" with "Add tag", "Remove tag", and "Cancel" buttons.

**Files:**
- `frontend/src/components/tasks/bulk-action-toolbar.tsx` (new)
- `frontend/src/components/tasks/kanban-board.tsx` (modify)

**Acceptance Criteria:**
- [ ] Toolbar appears when selectedTaskIds.size > 0
- [ ] Shows count: "N tasks selected"
- [ ] "Cancel" button clears all selections
- [ ] Toolbar is fixed at bottom, visually distinct (elevated, backdrop blur)
- [ ] Toolbar disappears when all tasks deselected

**Verification:** Select tasks → toolbar appears at bottom; click Cancel → toolbar disappears.

---

## Task 8: Bulk Add/Remove Tag Actions

**Description:** "Add tag" opens tag picker dropdown from toolbar. "Remove tag" opens picker showing only tags present on selected tasks. Both use `useBulkTag()` mutation. After action: deselect all, refresh board, show success toast.

**Files:**
- `frontend/src/components/tasks/bulk-action-toolbar.tsx` (modify)

**Acceptance Criteria:**
- [ ] "Add tag" opens tag picker with all user tags
- [ ] "Remove tag" opens picker filtered to tags on selected tasks
- [ ] Selecting a tag triggers bulk API call
- [ ] Success toast: "Tag added to N tasks" / "Tag removed from N tasks"
- [ ] Board refreshes after bulk operation
- [ ] All tasks deselected after operation
- [ ] Loading state on buttons during API call

**Verification:** Select 3 tasks → Add tag "Work" → verify all 3 tasks show "Work" tag pill.

---

## Task 9: Tests for Tags Management Tab

**Description:** Write tests for TagsManagementTab: renders tag list, create tag, edit tag, delete tag with confirmation.

**Files:**
- `frontend/__tests__/tags-management-tab.test.tsx` (new)

**Acceptance Criteria:**
- [ ] Test: renders tag list with names, colors, and task counts
- [ ] Test: create tag form appears and submits
- [ ] Test: inline edit saves changes
- [ ] Test: delete shows confirmation and removes tag
- [ ] Test: shows N/20 counter
- [ ] All tests pass

**Verification:** `npm test -- tags-management-tab`

---

## Task 10: Tests for Bulk Selection & Actions

**Description:** Write tests for multi-select on Kanban and bulk action toolbar.

**Files:**
- `frontend/__tests__/bulk-action-toolbar.test.tsx` (new)
- `frontend/__tests__/kanban-board.test.tsx` (modify — add selection tests)

**Acceptance Criteria:**
- [ ] Test: toolbar appears when tasks are selected
- [ ] Test: toolbar shows correct count
- [ ] Test: Cancel clears selection
- [ ] Test: Add tag triggers bulk API
- [ ] Test: Remove tag shows only relevant tags
- [ ] All tests pass

**Verification:** `npm test -- bulk-action-toolbar && npm test -- kanban-board`

---

## Execution Order

```
Task 1 → Task 2 → Task 3 → Task 4 → Task 5  (FR-10: Settings Tags)
Task 6 → Task 7 → Task 8                       (FR-11: Bulk Operations)
Task 9                                          (Tests for FR-10)
Task 10                                         (Tests for FR-11)
```

Tasks 1-5 and 6-8 are independent tracks that can be done in parallel.
Tasks 9 and 10 depend on their respective feature tasks.

---

## Summary

| # | Task | FR | Est. |
|---|------|----|------|
| 1 | Tags Management Tab Component | FR-10 | 20 min |
| 2 | Integrate Tags Tab into Settings | FR-10 | 10 min |
| 3 | Inline Tag Creation in Settings | FR-10 | 15 min |
| 4 | Inline Tag Edit (Rename & Recolor) | FR-10 | 20 min |
| 5 | Tag Delete with Confirmation | FR-10 | 15 min |
| 6 | Kanban Multi-Select Mode | FR-11 | 25 min |
| 7 | Bulk Action Toolbar | FR-11 | 20 min |
| 8 | Bulk Add/Remove Tag Actions | FR-11 | 20 min |
| 9 | Tests for Tags Management Tab | — | 15 min |
| 10 | Tests for Bulk Selection & Actions | — | 15 min |
