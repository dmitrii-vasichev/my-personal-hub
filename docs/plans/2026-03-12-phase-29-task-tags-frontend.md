# Phase 29: Task Tags — Frontend (Kanban & Task Dialog)

**PRD:** `docs/prd-task-tags.md`
**Phase:** 29 (Phase 2 of Task Tags feature)
**Scope:** FR-6 through FR-9 — Types, hooks, TagPill, TagPicker, TaskCard pills, TaskDialog integration, filter bar, task detail page

---

## Tasks

### Task 1: Tag Types and Task Type Extensions
**Issue title:** `[Phase 29, Task 1] Tag types and Task type extensions`
**Description:** Create `frontend/src/types/tag.ts` with `Tag`, `TagBrief` interfaces and the preset color palette constant. Extend `Task` type to include `tags: TagBrief[]`, extend `CreateTaskInput`/`UpdateTaskInput` with `tag_ids?: number[]`, extend `TaskFilters` with `tag_id?: number`.

**Files:** `frontend/src/types/tag.ts` (new), `frontend/src/types/task.ts` (modify)
**Acceptance criteria:**
- [ ] `Tag` interface: id, name, color, task_count, created_at
- [ ] `TagBrief` interface: id, name, color
- [ ] `TAG_PRESET_COLORS` constant with 8 colors from PRD
- [ ] `Task.tags: TagBrief[]` added
- [ ] `CreateTaskInput.tag_ids?: number[]` added
- [ ] `UpdateTaskInput.tag_ids?: number[]` added
- [ ] `TaskFilters.tag_id?: number` added
- [ ] TypeScript compiles without errors

---

### Task 2: `use-tags` React Query Hook
**Issue title:** `[Phase 29, Task 2] use-tags React Query hook for tag CRUD`
**Description:** Create `frontend/src/hooks/use-tags.ts` following the pattern of `use-tasks.ts`. Implements:
- `useTags()` — GET /api/tags, returns `Tag[]`, query key `["tags"]`
- `useCreateTag()` — POST /api/tags, invalidates `["tags"]`
- `useUpdateTag()` — PATCH /api/tags/{id}, invalidates `["tags"]`
- `useDeleteTag()` — DELETE /api/tags/{id}, invalidates `["tags"]`
- `useBulkTag()` — POST /api/tasks/bulk-tag, invalidates `["tags"]` + kanban/tasks keys

**Files:** `frontend/src/hooks/use-tags.ts` (new)
**Acceptance criteria:**
- [ ] `useTags()` returns list of tags with task_count
- [ ] `useCreateTag()` creates tag and invalidates cache
- [ ] `useUpdateTag()` updates tag and invalidates cache
- [ ] `useDeleteTag()` deletes tag and invalidates cache
- [ ] `useBulkTag()` sends bulk request and invalidates caches
- [ ] All mutations invalidate appropriate query keys (tags + kanban + tasks)

---

### Task 3: TagPill Reusable Component
**Issue title:** `[Phase 29, Task 3] TagPill reusable component`
**Description:** Create `frontend/src/components/tasks/tag-pill.tsx` — a compact pill that displays a tag's name with its color. Style per PRD FR-7.2: `rounded-full`, background is tag color at 15% opacity, text is tag color, font-size 10px, padding 1px 8px. Supports an optional `onRemove` callback (shows × button). Also export a `TagPills` wrapper component that shows max N tags + "+M" overflow indicator.

**Files:** `frontend/src/components/tasks/tag-pill.tsx` (new)
**Acceptance criteria:**
- [ ] `TagPill` renders tag name with correct color styling
- [ ] Background uses tag color at 15% opacity (inline style with hex-to-rgba)
- [ ] Text color matches tag color
- [ ] Optional `onRemove` shows × button
- [ ] `TagPills` component shows max `limit` pills (default 2) + "+N" overflow
- [ ] Works on both dark and light themes

---

### Task 4: TagPicker Component
**Issue title:** `[Phase 29, Task 4] TagPicker multi-select dropdown component`
**Description:** Create `frontend/src/components/tasks/tag-picker.tsx` — a multi-select dropdown for choosing tags. Uses Popover from `components/ui/popover.tsx`. Shows all user's tags with color dots. Selected tags are checked. Includes inline "Create tag" option at the bottom (name input + color preset picker). Triggers `useCreateTag()` for inline creation.

**Files:** `frontend/src/components/tasks/tag-picker.tsx` (new)
**Acceptance criteria:**
- [ ] Dropdown shows all user tags from `useTags()` with color dots
- [ ] Multi-select: clicking a tag toggles its selection
- [ ] Selected tags shown as removable pills below the trigger (using TagPill)
- [ ] "Create tag" option at bottom opens inline form (name + color presets)
- [ ] Inline creation uses `useCreateTag()` and auto-selects the new tag
- [ ] Empty state: "No tags yet — create one below"
- [ ] Props: `selectedTagIds: number[]`, `onChange: (ids: number[]) => void`

---

### Task 5: Tag Pills on TaskCard
**Issue title:** `[Phase 29, Task 5] Display tag pills on TaskCard`
**Description:** Modify `frontend/src/components/tasks/task-card.tsx` to render tag pills below the task title using the `TagPills` component. Show max 2 tags + "+N" overflow. Also update `TaskCardOverlay` (drag ghost) to show the same pills.

**Files:** `frontend/src/components/tasks/task-card.tsx` (modify)
**Acceptance criteria:**
- [ ] Tag pills appear below task title on TaskCard
- [ ] Max 2 tags visible, "+N" for overflow
- [ ] Pills use TagPills component with limit=2
- [ ] Drag overlay (TaskCardOverlay) also shows tag pills
- [ ] Cards without tags render unchanged (no empty space)
- [ ] Visual alignment consistent with existing card layout

---

### Task 6: Tag Picker in TaskDialog (Create Task)
**Issue title:** `[Phase 29, Task 6] Add TagPicker to TaskDialog for task creation`
**Description:** Modify `frontend/src/components/tasks/task-dialog.tsx` to add a "Tags" field using the TagPicker component. Place it between the Priority/Visibility row and the Checklist section. Include `tag_ids` in the `CreateTaskInput` payload sent to the API. On inline tag creation within the picker, the new tag should be auto-selected.

**Files:** `frontend/src/components/tasks/task-dialog.tsx` (modify)
**Acceptance criteria:**
- [ ] TagPicker appears in TaskDialog between priority and checklist
- [ ] Selected tag_ids included in createTask mutation payload
- [ ] Tags can be created inline from the picker without closing the dialog
- [ ] Dialog works correctly with zero tags selected (default)

---

### Task 7: Tag Filter in TaskFiltersBar
**Issue title:** `[Phase 29, Task 7] Add tag filter dropdown to TaskFiltersBar`
**Description:** Modify `frontend/src/components/tasks/task-filters.tsx` to add a tag filter dropdown after the priority filter. Single-select: picking a tag filters the board, picking "All tags" clears the filter. Uses Popover with tag list from `useTags()`. Active tag filter increments `activeCount` for the Clear button. Modify `buildTaskQuery()` in `use-tasks.ts` to include `tag_id` parameter.

**Files:** `frontend/src/components/tasks/task-filters.tsx` (modify), `frontend/src/hooks/use-tasks.ts` (modify)
**Acceptance criteria:**
- [ ] Tag dropdown appears after priority filter
- [ ] Shows all user's tags with color dots
- [ ] Single-select: clicking a tag sets filter, clicking again or "All tags" clears
- [ ] Active tag filter counted in activeCount for Clear button
- [ ] `buildTaskQuery()` includes `tag_id` when set
- [ ] Kanban board re-fetches with tag_id filter applied

---

### Task 8: Tags on Task Detail Page
**Issue title:** `[Phase 29, Task 8] Display and edit tags on task detail page`
**Description:** Modify `frontend/src/app/(dashboard)/tasks/[id]/page.tsx` to show tags in the right sidebar. Display current tags as TagPills. If `canEdit`, show TagPicker for editing. On tag change, call `useUpdateTask()` with updated `tag_ids`. Place tags section after Priority in the sidebar.

**Files:** `frontend/src/app/(dashboard)/tasks/[id]/page.tsx` (modify)
**Acceptance criteria:**
- [ ] Tags displayed as colored pills in the sidebar
- [ ] Editable via TagPicker when user has edit permissions
- [ ] Tag changes saved via updateTask mutation with tag_ids
- [ ] Tags section placed after Priority in sidebar
- [ ] Read-only display for users without edit permission

---

### Task 9: Tag Filter URL Persistence
**Issue title:** `[Phase 29, Task 9] Persist tag filter in URL search params`
**Description:** Modify `frontend/src/app/(dashboard)/tasks/page.tsx` to sync the `tag_id` filter with URL search params. When a tag filter is selected, update URL with `?tag=<id>`. On page load, read `tag` from URL and set initial filter. This ensures filtered state survives page refresh and is shareable.

**Files:** `frontend/src/app/(dashboard)/tasks/page.tsx` (modify)
**Acceptance criteria:**
- [ ] Selecting a tag filter updates URL: `?tag=<id>`
- [ ] Clearing tag filter removes `tag` from URL
- [ ] On page load, `tag` param from URL sets initial filter
- [ ] Works in combination with other potential URL params
- [ ] Browser back/forward navigates filter state

---

### Task 10: Frontend Tests for Tag Components
**Issue title:** `[Phase 29, Task 10] Frontend tests for tag types, hooks, and components`
**Description:** Write tests for:
- TagPill renders with correct color styling
- TagPills shows overflow indicator
- TagPicker renders tags and handles selection
- TaskCard renders tag pills
- Tag filter integration in filters bar
- use-tags hook (basic query/mutation tests)

**Files:** `frontend/src/__tests__/tag-pill.test.tsx` (new), `frontend/src/__tests__/tag-picker.test.tsx` (new), `frontend/src/__tests__/use-tags.test.tsx` (new)
**Acceptance criteria:**
- [ ] TagPill renders name and applies color styling
- [ ] TagPills shows "+N" when tags exceed limit
- [ ] TagPicker renders tag list and toggles selection
- [ ] TaskCard with tags renders pills
- [ ] All tests pass (`npm test`)
- [ ] No lint errors

---

## Dependencies

```
Task 1 (types) → Task 2 (hooks)
Task 1 → Task 3 (TagPill)
Task 2 + Task 3 → Task 4 (TagPicker)
Task 3 → Task 5 (TaskCard pills)
Task 4 → Task 6 (TaskDialog)
Task 2 → Task 7 (filters bar)
Task 4 → Task 8 (detail page)
Task 7 → Task 9 (URL persistence)
Task 5 + Task 6 + Task 7 + Task 8 → Task 10 (tests)
```

## Execution Order

1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10
