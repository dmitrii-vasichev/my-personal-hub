# PRD: Multi-Tag Filter

## Metadata
| Field | Value |
|-------|-------|
| Author | Dmitry |
| Date | 2026-03-12 |
| Status | Approved |
| Priority | P1 |

## Problem Statement
The current tag filter on the Tasks page only supports single-tag selection — either "All tags" or one specific tag. Users need the ability to select multiple tags simultaneously (e.g., show tasks tagged "Hub" and "Tech" but not "Learning") for more flexible task filtering. Additionally, untagged tasks cannot be explicitly filtered, and filters are lost when navigating to a task detail and back.

## User Scenarios

### Scenario 1: Exclude a tag
**As a** user, **I want to** deselect one tag from the filter, **so that** I see all tasks except those tagged with that tag.

### Scenario 2: Select specific tags
**As a** user, **I want to** select 2-3 specific tags, **so that** I only see tasks matching those tags.

### Scenario 3: Find untagged tasks
**As a** user, **I want to** filter for tasks with no tags, **so that** I can identify and organize them.

### Scenario 4: Preserve filters across navigation
**As a** user, **I want to** navigate to a task detail and return to the task list, **so that** my filters are still applied without re-selecting them.

## Functional Requirements

### P0 (Must Have)
- [ ] FR-1: Tag filter supports multi-select (checkboxes next to each tag)
- [ ] FR-2: By default all tags are selected including "No tag" (equivalent to current "All tags")
- [ ] FR-3: "All tags" option acts as select-all / deselect-all toggle
- [ ] FR-4: Clicking a tag toggles its selection state
- [ ] FR-5: Tasks are filtered to show only those matching ANY selected tag (OR logic)
- [ ] FR-6: Virtual "No tag" filter item — when selected, includes tasks with no tags; when deselected, hides them
- [ ] FR-7: URL sync with comma-separated format: `?tags=5,8,untagged`
- [ ] FR-8: Backend accepts `tag_ids` as comma-separated list, supports special value `untagged`
- [ ] FR-9: Filter persistence via URL + sessionStorage hybrid:
  - URL params are source of truth when present
  - Every filter change writes to both URL and sessionStorage
  - When navigating to `/tasks` without params, restore from sessionStorage
  - sessionStorage clears on tab close (fresh start = all tags selected)
- [ ] FR-10: "Back to tasks" button uses `router.back()` when history available, falls back to `/tasks`

## Technical Design

### Frontend Changes
- `TaskFilters.tag_id: number` → `tag_ids: number[]` + `include_untagged: boolean`
- `task-filters.tsx`: checkboxes, multi-select toggle logic, "No tag" virtual item
- `page.tsx`: URL sync with comma-separated `tags` param, sessionStorage read/write
- `use-tasks.ts`: send `tag_ids` + `include_untagged` as query params

### Backend Changes
- `tasks.py`: accept `tag_ids: str` (comma-separated, supports `untagged`), parse to list
- `task.py`: filter tasks where tag_id IN (list) OR (has no tags when `untagged` requested)

### Filter Persistence (URL + sessionStorage)
- Key: `tasks-filter-tags`
- Value: comma-separated tag ids string (e.g., `5,8,untagged`)
- Write: on every filter change
- Read: on page mount when URL has no `tags` param
- Clear: automatic on tab close (sessionStorage behavior)

## Out of Scope
- AND logic (requiring ALL selected tags on a task)
- Tag filter on other pages (jobs, notes)
- Saving filter presets / localStorage persistence

## Acceptance Criteria
- [ ] AC-1: User can select/deselect multiple tags in the filter dropdown
- [ ] AC-2: "All tags" selects/deselects all tags at once
- [ ] AC-3: Filtered view updates immediately on toggle
- [ ] AC-4: URL reflects selected tags as `?tags=5,8,12` or `?tags=5,untagged`
- [ ] AC-5: Page reload with `?tags=...` restores the filter state
- [ ] AC-6: Navigate to task detail → back → filters preserved
- [ ] AC-7: Close tab → open `/tasks` → all tags selected (clean state)
- [ ] AC-8: "No tag" filter works — shows/hides untagged tasks
- [ ] AC-9: Backend tests cover multi-tag and untagged filtering
