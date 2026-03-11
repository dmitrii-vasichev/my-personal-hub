# Phase 25: Note Linking — Frontend UI

## Overview

Add "Linked Notes" sections to task detail, job detail, and calendar event detail pages. Create a reusable note-link dialog component for searching and linking notes. Implement last-opened-file persistence on the Notes page. All frontend — no backend changes.

## Prerequisites

- Phase 24 merged (Note linking backend: models, services, API endpoints)
- Phase 23 merged (Notes page UI: tree browser, markdown viewer)
- Backend API endpoints available:
  - `GET /api/tasks/{taskId}/linked-notes` → `LinkedNoteBrief[]`
  - `GET /api/jobs/{jobId}/linked-notes` → `LinkedNoteBrief[]`
  - `GET /api/calendar/events/{eventId}/linked-notes` → `LinkedNoteBrief[]`
  - `POST /api/notes/{noteId}/link-task/{taskId}` → 204
  - `DELETE /api/notes/{noteId}/link-task/{taskId}` → 204
  - `POST /api/notes/{noteId}/link-job/{jobId}` → 204
  - `DELETE /api/notes/{noteId}/link-job/{jobId}` → 204
  - `POST /api/notes/{noteId}/link-event/{eventId}` → 204
  - `DELETE /api/notes/{noteId}/link-event/{eventId}` → 204
  - `GET /api/notes/` → `Note[]` (for search in link dialog)

## Tasks

### Task 1: LinkedNoteBrief type + note-link hooks

**Description:** Add `LinkedNoteBrief` TypeScript interface and React Query hooks for note linking on all three entity types.

**Files:**
- MOD `frontend/src/types/note.ts` — add `LinkedNoteBrief` interface
- NEW `frontend/src/hooks/use-note-links.ts` — hooks for all 3 entity types

**Details:**

Add to `types/note.ts`:
```typescript
export interface LinkedNoteBrief {
  id: number;
  title: string;
  folder_path: string | null;
  google_file_id: string;
}
```

Create `hooks/use-note-links.ts` following the `use-job-links.ts` pattern:

```typescript
// Task ↔ Note
export function useTaskLinkedNotes(taskId: number)
export function useLinkNoteToTask(taskId: number)    // mutationFn: (noteId) => POST /api/notes/{noteId}/link-task/{taskId}
export function useUnlinkNoteFromTask(taskId: number) // mutationFn: (noteId) => DELETE /api/notes/{noteId}/link-task/{taskId}

// Job ↔ Note
export function useJobLinkedNotes(jobId: number)
export function useLinkNoteToJob(jobId: number)
export function useUnlinkNoteFromJob(jobId: number)

// Event ↔ Note
export function useEventLinkedNotes(eventId: number)
export function useLinkNoteToEvent(eventId: number)
export function useUnlinkNoteFromEvent(eventId: number)
```

Key pattern details:
- Query keys: `["tasks", taskId, "linked-notes"]`, `["jobs", jobId, "linked-notes"]`, `["calendar-events", eventId, "linked-notes"]`
- On mutation success: invalidate the relevant linked-notes query
- `enabled: entityId > 0` on all queries
- Link mutations call POST on notes router: `/api/notes/{noteId}/link-task/{taskId}`
- Unlink mutations call DELETE on notes router: `/api/notes/{noteId}/link-task/{taskId}`

**Acceptance Criteria:**
- [ ] `LinkedNoteBrief` type exported from `types/note.ts`
- [ ] All 9 hooks exported and working
- [ ] Correct query key invalidation on mutations
- [ ] No TypeScript errors

**Verification:** `npx tsc --noEmit`

---

### Task 2: Reusable LinkedNotesSection component

**Description:** Create a reusable "Linked Notes" section component that can be embedded in any entity detail page. Follow the `LinkedTasksSection` pattern from jobs.

**Files:**
- NEW `frontend/src/components/notes/linked-notes-section.tsx`

**Details:**

Props:
```typescript
interface LinkedNotesSectionProps {
  notes: LinkedNoteBrief[];
  isLoading: boolean;
  onLink: (noteId: number) => void;
  onUnlink: (noteId: number) => void;
  isLinking?: boolean;
}
```

Component structure (follow `linked-tasks-section.tsx` pattern):
1. **Header row:** "Linked Notes" title + count badge + "+ Link" button (opens dialog)
2. **Content area:**
   - **Loading state:** Loader2 spinner
   - **Empty state:** FileText icon + "No linked notes" text
   - **Notes list:** Each note as a card showing:
     - FileText icon
     - Note title (clickable → navigates to `/notes?file={google_file_id}`)
     - Folder path as muted breadcrumb text
     - X button to unlink
3. **Link dialog** (triggered by "+ Link" button):
   - Dialog with search input (filters notes by title)
   - Scrollable list of all available notes (from `useNotes()` hook)
   - Each note shows title + folder_path
   - Click to link, dialog closes
   - Already-linked notes shown as disabled / with check mark

**Acceptance Criteria:**
- [ ] Component renders loading, empty, and populated states
- [ ] Link dialog opens, searches, and links notes
- [ ] Unlink button removes notes
- [ ] Click on note title navigates to Notes page with file selected
- [ ] Design matches existing LinkedTasksSection style

**Verification:** Visual inspection + build passes

---

### Task 3: Add Linked Notes to Task detail page

**Description:** Integrate `LinkedNotesSection` into the task detail page sidebar.

**Files:**
- MOD `frontend/src/app/(dashboard)/tasks/[id]/page.tsx`

**Details:**
- Import `LinkedNotesSection` and hooks (`useTaskLinkedNotes`, `useLinkNoteToTask`, `useUnlinkNoteFromTask`)
- Place the section in the right sidebar, after `LinkedEvents` component (around line 414)
- Wire up the hooks to the component props
- Pattern: same as how `LinkedEvents` is integrated

**Acceptance Criteria:**
- [ ] "Linked Notes" section visible on task detail page
- [ ] Can link a note to a task via dialog
- [ ] Can unlink a note from a task
- [ ] Linked notes show title + folder path
- [ ] Click on note navigates to Notes page

**Verification:** Visual inspection on task detail page

---

### Task 4: Add Linked Notes to Job detail page

**Description:** Integrate `LinkedNotesSection` into the job detail page main content area.

**Files:**
- MOD `frontend/src/components/jobs/job-detail.tsx`

**Details:**
- Import `LinkedNotesSection` and hooks (`useJobLinkedNotes`, `useLinkNoteToJob`, `useUnlinkNoteFromJob`)
- Place after `LinkedEventsSection` (around line 311), inside the main content area
- Wire up hooks to component props

**Acceptance Criteria:**
- [ ] "Linked Notes" section visible on job detail page
- [ ] Can link/unlink notes to/from a job
- [ ] Consistent with existing LinkedTasksSection and LinkedEventsSection styling

**Verification:** Visual inspection on job detail page

---

### Task 5: Add Linked Notes to Calendar event detail page

**Description:** Integrate `LinkedNotesSection` into the calendar event detail page.

**Files:**
- MOD `frontend/src/app/(dashboard)/calendar/[id]/page.tsx`

**Details:**
- Import `LinkedNotesSection` and hooks (`useEventLinkedNotes`, `useLinkNoteToEvent`, `useUnlinkNoteFromEvent`)
- Place after `LinkedTasks` component (around line 174), before `EventNotes`
- Add separator (`border-t border-[--border] pt-6 mt-6`) consistent with other sections

**Acceptance Criteria:**
- [ ] "Linked Notes" section visible on event detail page
- [ ] Can link/unlink notes to/from a calendar event
- [ ] Design consistent with existing LinkedTasks section on same page

**Verification:** Visual inspection on event detail page

---

### Task 6: Notes page — URL-based file selection

**Description:** Support selecting a note file via URL query parameter, so "Linked Notes" clicks can navigate to `/notes?file={google_file_id}` and auto-open the file.

**Files:**
- MOD `frontend/src/app/(dashboard)/notes/page.tsx`

**Details:**
- Read `?file=` query parameter from URL using `useSearchParams()`
- On mount (or when `file` param changes): if `file` param present, set `selectedFileId` to that value
- Auto-expand the tree to reveal the selected file (traverse tree nodes to find path)
- If file param is present but file not found in tree, show a subtle toast/notification

**Acceptance Criteria:**
- [ ] Navigating to `/notes?file=abc123` auto-selects and displays that file
- [ ] Tree expands to show the selected file's location
- [ ] Works when clicking linked note from task/job/event pages

**Verification:** Navigate to `/notes?file=<valid_file_id>` → file content displayed

---

### Task 7: Last opened file persistence (FR-15)

**Description:** Remember the last opened note file and auto-open it when returning to the Notes page.

**Files:**
- MOD `frontend/src/app/(dashboard)/notes/page.tsx`

**Details:**
- On file selection, save `{ fileId, filePath }` to `localStorage` key `"notes:lastOpenedFile"`
- On Notes page mount: if no `?file=` URL param, read from localStorage and auto-select
- URL param takes priority over localStorage
- Clear localStorage entry if the file is no longer in the tree (optional, graceful fallback)

**Acceptance Criteria:**
- [ ] Selecting a file persists it to localStorage
- [ ] Returning to Notes page auto-opens last viewed file
- [ ] URL `?file=` param overrides localStorage
- [ ] No errors if localStorage entry references a deleted/moved file

**Verification:** Select a file, navigate away, return → same file shown

---

### Task 8: Frontend tests for note linking

**Description:** Write tests for the LinkedNotesSection component and note-link hooks.

**Files:**
- NEW `frontend/src/__tests__/components/notes/linked-notes-section.test.tsx`

**Test cases:**
1. Renders loading state (spinner visible)
2. Renders empty state when no notes linked
3. Renders list of linked notes with titles and folder paths
4. Unlink button calls onUnlink with correct noteId
5. Link button opens dialog
6. Dialog search filters notes by title
7. Clicking a note in dialog calls onLink

**Acceptance Criteria:**
- [ ] All tests pass (`npm test`)
- [ ] Component rendering and interaction covered
- [ ] No lint errors

**Verification:** `cd frontend && npm test -- --testPathPattern=linked-notes-section`

---

## Task Dependencies

```
Task 1 (types + hooks) ──> Task 2 (LinkedNotesSection component)
                                │
                                ├──> Task 3 (integrate in Tasks)
                                ├──> Task 4 (integrate in Jobs)
                                ├──> Task 5 (integrate in Calendar)
                                │
                                └──> Task 6 (URL-based file selection)
                                        │
                                        └──> Task 7 (localStorage persistence)

Task 2 ──> Task 8 (tests)
```

## Execution Order

1. Task 1 (types + hooks)
2. Task 2 (LinkedNotesSection component)
3. Tasks 3, 4, 5 (integrate into entity pages — can be parallel)
4. Task 6 (URL-based file selection on Notes page)
5. Task 7 (localStorage persistence)
6. Task 8 (tests)

## Estimated Scope

- 8 tasks
- 2 new files, 6 modified files
- Focus: React components, hooks, page integration
- All frontend — no backend changes
