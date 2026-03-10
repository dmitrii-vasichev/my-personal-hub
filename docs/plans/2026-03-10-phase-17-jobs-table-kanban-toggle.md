# Phase 17: Jobs Table View & Kanban Toggle

**Date**: 2026-03-10
**PRD Reference**: docs/prd-job-hunt-redesign.md
**Requirements**: FR-1 (Jobs Table View), FR-2 (Table ↔ Kanban Toggle), FR-3 partial (Job Detail — source URL, status control)

## Overview

Replace the card-grid jobs list with a sortable data table (TanStack Table) and add a view toggle to switch between table and kanban. Partially redesign the job detail page with improved source URL display and status change control.

## Current State

- Jobs tab: 3-column card grid (`JobCard` components)
- Pipeline tab: drag-and-drop kanban (`ApplicationKanban`)
- Search tab: external job board search
- Analytics tab: charts
- Job detail page: 2-column layout (content + sidebar)
- TanStack Table: **NOT installed** (only TanStack Query exists)
- No view toggle mechanism exists

## Tasks

### Task 1: Install @tanstack/react-table dependency

**Description**: Add TanStack Table v8 to frontend dependencies.

**Files**:
- `frontend/package.json`

**Acceptance Criteria**:
- [ ] `@tanstack/react-table` is in dependencies
- [ ] `npm install` succeeds without errors
- [ ] Build passes

**Verification**: `cd frontend && npm ls @tanstack/react-table`

---

### Task 2: Create JobsTable component

**Description**: Build a reusable data table component using TanStack Table for the jobs list. Columns: Title (with company subtitle), Status badge (from application), Match Score (color-coded badge), Source, Found Date. All columns sortable. Rows clickable → navigate to `/jobs/[id]`. Follow design-brief.md styling (--surface bg, --border, 14px radius).

**Dependencies**: Task 1

**Files**:
- `frontend/src/components/jobs/jobs-table.tsx` (NEW)
- `frontend/src/types/job.ts` (may need minor updates)

**Acceptance Criteria**:
- [ ] Table renders all jobs with correct columns
- [ ] Each column is sortable (click header to toggle asc/desc)
- [ ] Sort indicator (arrow icon) shown on active sort column
- [ ] Match score uses color-coded badges (green ≥80, amber ≥60, gray <60)
- [ ] Application status shows as badge (same colors as kanban)
- [ ] Empty state shown when no jobs
- [ ] Row click navigates to `/jobs/[id]`
- [ ] Responsive: horizontal scroll on mobile
- [ ] Follows design-brief.md styling

**Verification**: Visual check — table renders, sorting works, click navigates

---

### Task 3: Create ViewToggle component

**Description**: Build a toggle component that switches between "table" and "kanban" views. Persist selection in localStorage (`jobs-view-preference`). Use shadcn/ui Tabs or ToggleGroup styled to match design brief.

**Files**:
- `frontend/src/components/jobs/view-toggle.tsx` (NEW)

**Acceptance Criteria**:
- [ ] Toggle shows two options: Table (list icon) and Kanban (columns icon)
- [ ] Active option is visually highlighted
- [ ] Selection persists in localStorage
- [ ] On page load, restores last selected view
- [ ] Defaults to "table" if no preference saved

**Verification**: Toggle between views, refresh page — preference persists

---

### Task 4: Integrate table view and toggle into Jobs page

**Description**: Replace the card grid in the Jobs tab with the new table/kanban toggle. When "table" is selected, show JobsTable. When "kanban" is selected, show the existing ApplicationKanban (moved from Pipeline tab or shared). Update the filter bar to work with both views. Consider merging Pipeline tab functionality into Jobs tab kanban view.

**Dependencies**: Tasks 2, 3

**Files**:
- `frontend/src/app/(dashboard)/jobs/page.tsx` (MODIFY)
- `frontend/src/components/jobs/jobs-list.tsx` (MODIFY — may become wrapper or deprecated)

**Acceptance Criteria**:
- [ ] Jobs tab shows ViewToggle above the content area
- [ ] Table view is the default
- [ ] Kanban view shows existing kanban board
- [ ] Existing filter bar (search, source, applied toggle) works with table view
- [ ] Sorting in table view works (overrides/supplements filter sort)
- [ ] Pipeline tab remains functional (or is merged — TBD based on UX)
- [ ] Card grid is replaced by table in the default view

**Verification**: Switch between views, apply filters in both, check data consistency

---

### Task 5: Add match score to Kanban cards

**Description**: Update the kanban card component to display the match score badge (same color coding as table view). Show score below the company name or in the top-right corner.

**Dependencies**: Task 4

**Files**:
- `frontend/src/components/jobs/application-kanban.tsx` (MODIFY)

**Acceptance Criteria**:
- [ ] Match score badge visible on kanban cards (when score exists)
- [ ] Same color coding as table: green ≥80, amber ≥60, gray <60
- [ ] Cards without match score show no badge (not "N/A")
- [ ] Kanban layout not broken by additional badge

**Verification**: Visual check — kanban cards show match scores

---

### Task 6: Redesign job detail page — source URL section

**Description**: Improve the source URL display on the job detail page. Make it a prominent clickable button that opens in a new tab. Add a copy-URL action. If URL is missing, show "No source link" muted text.

**Files**:
- `frontend/src/components/jobs/job-detail.tsx` (MODIFY)

**Acceptance Criteria**:
- [ ] Source URL displayed as a styled button/link with external link icon
- [ ] Clicking opens URL in new tab (`target="_blank" rel="noopener"`)
- [ ] If no URL, show muted "No source link" text
- [ ] Button uses design-brief accent color or secondary style

**Verification**: Click source URL → opens in new tab; check with job that has no URL

---

### Task 7: Redesign job detail page — status change control

**Description**: Redesign the application status section on the job detail page. Replace the current simple badge + "View Application" button with a status dropdown/selector that allows changing status directly from the detail page (without navigating to the application). Show status as a prominent badge with a dropdown to change it. Include "Start Tracking" button for untracked jobs.

**Files**:
- `frontend/src/components/jobs/job-detail.tsx` (MODIFY)
- `frontend/src/hooks/use-applications.ts` (may need update for status change)

**Acceptance Criteria**:
- [ ] For tracked jobs: current status shown as badge + dropdown to change status
- [ ] Status change triggers API call and updates UI immediately
- [ ] Status options match pipeline columns (found, saved, applied, screening, etc.)
- [ ] For untracked jobs: "Start Tracking" button (existing behavior preserved)
- [ ] Status badge uses same colors as kanban/table
- [ ] Confirmation dialog on status change to terminal statuses (rejected, withdrawn)

**Verification**: Change status from detail page, verify it updates in table/kanban views

---

### Task 8: Add backend sort_by extensions for table columns

**Description**: The existing backend supports `sort_by` with `created_at`, `company`, `match_score`. Add support for sorting by `title`, `source`, and `found_at` to support all table columns. Also add `status` sorting (by application status).

**Files**:
- `backend/app/api/jobs.py` (MODIFY)
- `backend/app/services/job.py` (MODIFY)

**Acceptance Criteria**:
- [ ] `sort_by=title` sorts jobs by title alphabetically
- [ ] `sort_by=source` sorts jobs by source
- [ ] `sort_by=found_at` sorts jobs by found_at date
- [ ] Existing sort options still work
- [ ] Tests cover new sort options

**Verification**: `curl` or test API with new sort_by values

---

### Task 9: Tests for table and toggle components

**Description**: Write frontend tests for JobsTable and ViewToggle components. Test rendering, sorting interaction, localStorage persistence, and navigation on row click.

**Dependencies**: Tasks 2, 3

**Files**:
- `frontend/__tests__/jobs-table.test.tsx` (NEW)
- `frontend/__tests__/view-toggle.test.tsx` (NEW)

**Acceptance Criteria**:
- [ ] JobsTable renders with mock data
- [ ] Column headers are clickable for sorting
- [ ] ViewToggle renders both options
- [ ] ViewToggle persists selection to localStorage
- [ ] Tests pass: `npm test`

**Verification**: `cd frontend && npm test`

---

### Task 10: Backend tests for new sort options

**Description**: Add backend tests for the new sort_by options (title, source, found_at).

**Dependencies**: Task 8

**Files**:
- `backend/tests/test_jobs.py` (MODIFY or NEW)

**Acceptance Criteria**:
- [ ] Tests verify sort_by=title returns jobs in alphabetical order
- [ ] Tests verify sort_by=source works
- [ ] Tests verify sort_by=found_at works
- [ ] All existing tests still pass
- [ ] `pytest` passes

**Verification**: `cd backend && python -m pytest tests/test_jobs.py -v`

---

## Task Dependency Graph

```
Task 1 (install TanStack Table)
  ├── Task 2 (JobsTable component)
  │     └── Task 4 (integrate into Jobs page)
  │           └── Task 5 (match score on kanban)
  └── Task 3 (ViewToggle component)
        └── Task 4 (integrate into Jobs page)

Task 6 (detail page — source URL) — independent
Task 7 (detail page — status control) — independent

Task 8 (backend sort extensions)
  └── Task 10 (backend tests)

Task 9 (frontend tests) — depends on Tasks 2, 3
```

## Execution Order

1. Task 1 — Install dependency
2. Task 8 — Backend sort extensions (independent, can parallelize)
3. Task 2 — JobsTable component
4. Task 3 — ViewToggle component
5. Task 4 — Integrate into Jobs page
6. Task 5 — Match score on kanban cards
7. Task 6 — Detail page: source URL
8. Task 7 — Detail page: status control
9. Task 9 — Frontend tests
10. Task 10 — Backend tests
