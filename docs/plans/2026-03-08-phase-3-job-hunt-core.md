# Phase 3: Job Hunt — Core

## Overview
Job Hunt core module — job CRUD, application tracking pipeline, applications Kanban board with drag-and-drop, application detail with recruiter info, notes, and status history.

Covers: FR-16 through FR-19.

## URL Structure
- `/jobs` — Job Hunt main page with tabs: **Jobs** (list) and **Pipeline** (applications Kanban)
- `/jobs/[id]` — Job detail page (with linked application info)
- `/jobs/applications/[id]` — Application detail page (notes, recruiter, status history)

Sidebar already has "Job Hunt" → `/jobs` — no sidebar changes needed.

## Tasks

### Task 1: Database schema — jobs, applications, status_history tables

**Description:** Create SQLAlchemy models for `jobs`, `applications`, and `status_history` tables with Alembic migration 003. Define enums for job source, application status.

**Files:**
- `backend/app/models/job.py` — Job, Application, StatusHistory models
- `backend/app/models/__init__.py` — re-export new models
- `backend/alembic/env.py` — import new models
- `backend/alembic/versions/003_create_jobs_applications.py` — migration

**Schema (jobs):**
- `id` INTEGER PK
- `user_id` INTEGER FK → users.id, CASCADE, NOT NULL, indexed
- `title` VARCHAR(255) NOT NULL
- `company` VARCHAR(255) NOT NULL
- `location` VARCHAR(255), nullable
- `url` TEXT, nullable
- `source` VARCHAR(50), default "manual" (manual, adzuna, serpapi, jsearch — extensible for Phase 4)
- `description` TEXT, nullable
- `salary_min` INTEGER, nullable
- `salary_max` INTEGER, nullable
- `salary_currency` VARCHAR(10), default "USD"
- `match_score` INTEGER, nullable (0-100)
- `tags` JSON, default []
- `found_at` TIMESTAMPTZ, nullable
- `created_at` TIMESTAMPTZ, server_default=now()
- `updated_at` TIMESTAMPTZ, server_default=now(), onupdate

**Schema (applications):**
- `id` INTEGER PK
- `user_id` INTEGER FK → users.id, CASCADE, NOT NULL, indexed
- `job_id` INTEGER FK → jobs.id, CASCADE, NOT NULL
- `status` ENUM(found, saved, resume_generated, applied, screening, technical_interview, final_interview, offer, accepted, rejected, ghosted, withdrawn), default "found"
- `notes` TEXT, nullable
- `recruiter_name` VARCHAR(255), nullable
- `recruiter_contact` VARCHAR(255), nullable
- `applied_date` DATE, nullable
- `next_action` VARCHAR(255), nullable
- `next_action_date` DATE, nullable
- `rejection_reason` TEXT, nullable
- `created_at` TIMESTAMPTZ, server_default=now()
- `updated_at` TIMESTAMPTZ, server_default=now(), onupdate

**Schema (status_history):**
- `id` INTEGER PK
- `application_id` INTEGER FK → applications.id, CASCADE, NOT NULL, indexed
- `old_status` VARCHAR(50), nullable (null for initial)
- `new_status` VARCHAR(50), NOT NULL
- `comment` TEXT, nullable
- `changed_at` TIMESTAMPTZ, server_default=now()

**Indexes:**
- `ix_jobs_user_id` on jobs.user_id
- `ix_applications_user_status` on (applications.user_id, applications.status)
- `ix_applications_job_id` on applications.job_id
- `ix_status_history_application_id` on status_history.application_id

**Relationships:**
- Job → has_many Applications (back_populates)
- Application → belongs_to Job (back_populates), has_many StatusHistory
- StatusHistory → belongs_to Application

**Acceptance Criteria:**
- [ ] `alembic upgrade head` creates all 3 tables
- [ ] All fields match PRD spec
- [ ] FK constraints with CASCADE
- [ ] Unique constraint: one active application per job per user (optional, consider)
- [ ] Indexes created

**Verification:** `alembic upgrade head` succeeds

---

### Task 2: Jobs CRUD API — create, read, update, delete, list with filters

**Description:** Full jobs endpoints: CRUD + filtered list. Follow same patterns as tasks API.

**Files:**
- `backend/app/api/jobs.py` — jobs router
- `backend/app/schemas/job.py` — Pydantic schemas (JobCreate, JobUpdate, JobResponse, JobListResponse)
- `backend/app/services/job.py` — job business logic
- `backend/app/main.py` — register router

**Endpoints:**
- `POST /api/jobs/` — create job
- `GET /api/jobs/{id}` — get job by ID (with linked application if exists)
- `PATCH /api/jobs/{id}` — update job
- `DELETE /api/jobs/{id}` — delete job (cascades to applications)
- `GET /api/jobs/` — list jobs with filters:
  - `search` — ILIKE on title, company, description
  - `company` — filter by company name
  - `source` — filter by source
  - `has_application` — boolean, filter jobs with/without application
  - `tags` — filter by tag
  - `sort_by` — created_at, company, match_score (default: created_at)
  - `sort_order` — asc/desc (default: desc)

**Access Rules:**
- User sees own jobs only
- Admin sees all jobs

**Acceptance Criteria:**
- [ ] Create sets user_id = current user
- [ ] Get returns job with application summary (status, applied_date) if linked
- [ ] All filters work and combine correctly
- [ ] Search is case-insensitive
- [ ] Delete cascades to applications and status_history
- [ ] Non-owner gets 403 (unless admin)

**Verification:** curl POST create → GET → PATCH → list with filters → DELETE

---

### Task 3: Applications CRUD API — create, read, update, status transitions

**Description:** Application endpoints with status pipeline logic. Status changes auto-create status_history entries.

**Files:**
- `backend/app/api/applications.py` — applications router
- `backend/app/schemas/application.py` — Pydantic schemas
- `backend/app/services/application.py` — application business logic

**Endpoints:**
- `POST /api/applications/` — create application (requires job_id, optional initial status)
- `GET /api/applications/{id}` — get application with job info and status history
- `PATCH /api/applications/{id}` — update application fields
- `DELETE /api/applications/{id}` — delete application
- `PATCH /api/applications/{id}/status` — dedicated status change endpoint (new_status + optional comment)

**Status Change Logic:**
- When status changes, auto-create StatusHistory entry (old_status, new_status, comment, changed_at)
- When status = "applied", auto-set applied_date = today if not already set
- Terminal statuses: accepted, rejected, ghosted, withdrawn

**Acceptance Criteria:**
- [ ] Create application links to existing job
- [ ] One application per job per user (409 if duplicate)
- [ ] Status change creates status_history entry
- [ ] Get returns full application with nested job info and status_history
- [ ] Status change to "applied" auto-sets applied_date
- [ ] User can only access own applications

**Verification:** Create application → change status → check status_history created → get full detail

---

### Task 4: Applications Kanban + list API

**Description:** Kanban endpoint (applications grouped by status) and filtered list endpoint for applications.

**Files:**
- `backend/app/api/applications.py` — add kanban and list endpoints
- `backend/app/services/application.py` — kanban and list logic

**Endpoints:**
- `GET /api/applications/kanban` — returns applications grouped by status columns, each with job info
- `GET /api/applications/` — list applications with filters:
  - `status` — comma-separated status filter
  - `search` — ILIKE on job title, company
  - `sort_by` — created_at, updated_at, applied_date, next_action_date
  - `sort_order` — asc/desc
- `GET /api/applications/{id}/history` — status history for an application

**Kanban Response Shape:**
```json
{
  "found": [{ application + job summary }],
  "saved": [...],
  "resume_generated": [...],
  "applied": [...],
  "screening": [...],
  "technical_interview": [...],
  "final_interview": [...],
  "offer": [...],
  "accepted": [...],
  "rejected": [...],
  "ghosted": [...],
  "withdrawn": [...]
}
```

**Acceptance Criteria:**
- [ ] Kanban returns all status groups (empty arrays for unused statuses)
- [ ] Each application in kanban includes job title, company, applied_date, next_action
- [ ] List filters work and combine
- [ ] History endpoint returns ordered status changes
- [ ] Access control: user sees own, admin sees all

**Verification:** Create multiple applications with different statuses → kanban returns correct grouping

---

### Task 5: Frontend — TypeScript types + TanStack Query hooks

**Description:** Define all Job Hunt TypeScript types and TanStack Query hooks for jobs and applications.

**Files:**
- `frontend/src/types/job.ts` — Job, Application, StatusHistory, enums, constants (status labels, colors)
- `frontend/src/hooks/use-jobs.ts` — query hooks for jobs (CRUD, list, filters)
- `frontend/src/hooks/use-applications.ts` — query hooks for applications (CRUD, kanban, status change, history)

**Types:**
```typescript
type ApplicationStatus = "found" | "saved" | "resume_generated" | "applied" | "screening" | "technical_interview" | "final_interview" | "offer" | "accepted" | "rejected" | "ghosted" | "withdrawn"

interface Job {
  id: number; user_id: number; title: string; company: string;
  location?: string; url?: string; source: string;
  description?: string; salary_min?: number; salary_max?: number;
  salary_currency: string; match_score?: number; tags: string[];
  found_at?: string; created_at: string; updated_at: string;
  application?: ApplicationSummary; // linked application info
}

interface Application {
  id: number; user_id: number; job_id: number;
  status: ApplicationStatus; notes?: string;
  recruiter_name?: string; recruiter_contact?: string;
  applied_date?: string; next_action?: string; next_action_date?: string;
  rejection_reason?: string;
  job?: Job; // nested job info
  status_history?: StatusHistoryEntry[];
  created_at: string; updated_at: string;
}

interface StatusHistoryEntry {
  id: number; application_id: number;
  old_status?: string; new_status: string;
  comment?: string; changed_at: string;
}
```

**Constants:**
- `APPLICATION_STATUS_LABELS` — human-readable labels for each status
- `APPLICATION_STATUS_COLORS` — color tokens per status (matching design-brief)
- `KANBAN_COLUMNS` — ordered list of statuses for Kanban display (may group terminal statuses)

**Hooks:**
- `useJobs(filters)` — list jobs
- `useJob(id)` — single job
- `useCreateJob()` — mutation
- `useUpdateJob()` — mutation
- `useDeleteJob()` — mutation
- `useApplications(filters)` — list applications
- `useApplication(id)` — single application with job + history
- `useApplicationKanban()` — kanban grouped data
- `useCreateApplication()` — mutation
- `useUpdateApplication()` — mutation
- `useChangeApplicationStatus()` — mutation (optimistic for drag-and-drop)
- `useDeleteApplication()` — mutation
- `useStatusHistory(applicationId)` — history list

**Acceptance Criteria:**
- [ ] All types match backend response schemas
- [ ] Hooks follow established patterns from use-tasks.ts
- [ ] Optimistic update for status changes (drag-and-drop)
- [ ] Proper cache invalidation (kanban + list on status change)
- [ ] Status constants include labels, colors for all 12 statuses

**Verification:** Import hooks in a test component → data fetches correctly

---

### Task 6: Frontend — Jobs list page with filters

**Description:** Jobs list view within `/jobs` page. Table/card layout showing all saved jobs with search, filters, and actions (edit, delete, create application).

**Files:**
- `frontend/src/app/(dashboard)/jobs/page.tsx` — Jobs page (with tab navigation: Jobs / Pipeline)
- `frontend/src/components/jobs/jobs-list.tsx` — jobs list/table component
- `frontend/src/components/jobs/job-card.tsx` — job card for list view
- `frontend/src/components/jobs/job-filters.tsx` — filter bar

**Layout:**
- Tab bar at top: "Jobs" (active) | "Pipeline"
- Filter bar below tabs: search input, source filter, has-application toggle
- List below: cards or table rows showing title, company, location, salary range, tags, match score, application status badge
- Each row has actions: Edit, Delete, "Start Application" (if no application linked)

**Acceptance Criteria:**
- [ ] Jobs listed with all key info visible
- [ ] Search filters by title/company (debounced 300ms)
- [ ] "Start Application" creates application and switches to Pipeline tab
- [ ] Empty state when no jobs exist
- [ ] Responsive layout
- [ ] Tab navigation between Jobs and Pipeline views
- [ ] Styles match design-brief.md

**Verification:** Create jobs → see them in list → filter → create application from list

---

### Task 7: Frontend — Job create/edit dialog + detail page

**Description:** Dialog for creating/editing jobs. Detail page at `/jobs/[id]` showing full job info and linked application.

**Files:**
- `frontend/src/components/jobs/job-dialog.tsx` — create/edit dialog
- `frontend/src/app/(dashboard)/jobs/[id]/page.tsx` — job detail page
- `frontend/src/components/jobs/job-detail.tsx` — detail view component

**Job Dialog Fields:**
- Title (required), Company (required), Location, URL
- Description (textarea)
- Salary range: min, max, currency
- Tags (multi-input)
- Match score (0-100 slider or input)

**Detail Page Layout:**
- Header: title, company, location
- Body: description, salary, tags, match score, URL link
- Sidebar/section: linked application status + quick actions
- Back button to jobs list

**Acceptance Criteria:**
- [ ] Create mode: empty form, "Add Job" button
- [ ] Edit mode: pre-filled form, "Save Changes" button
- [ ] Title and company required, validation with error messages
- [ ] Tags input: add/remove tags
- [ ] Detail page shows all job fields
- [ ] If application exists, shows application status badge + link to application detail
- [ ] Responsive layout

**Verification:** Create job via dialog → see in list → open detail → edit → changes saved

---

### Task 8: Frontend — Applications Kanban board with drag-and-drop

**Description:** Applications Kanban board on the "Pipeline" tab at `/jobs`. Columns for each application status. Cards show job title, company, applied date, next action. Drag-and-drop to change status.

**Files:**
- `frontend/src/components/jobs/application-kanban.tsx` — board container
- `frontend/src/components/jobs/application-column.tsx` — single column
- `frontend/src/components/jobs/application-card.tsx` — card component

**Kanban Columns (ordered):**
Pipeline columns: Found, Saved, Resume Generated, Applied, Screening, Technical Interview, Final Interview, Offer
Terminal columns (collapsed/grouped at end): Accepted, Rejected, Ghosted, Withdrawn

**Card Content:**
- Job title (bold)
- Company name
- Applied date (if set)
- Next action + date (if set)
- Status-colored left border or top accent

**Design (per design-brief.md):**
- Same Kanban patterns as task board: transparent column bg, uppercase headers, count badges
- Drag handle on hover
- Optimistic UI on drag

**Acceptance Criteria:**
- [ ] All pipeline status columns rendered with correct counts
- [ ] Terminal statuses grouped or collapsible
- [ ] Cards show job title, company, key dates
- [ ] Drag-and-drop changes status, calls API
- [ ] Optimistic update (card moves immediately, reverts on error)
- [ ] On status change to "applied", prompt or auto-set applied_date
- [ ] Mobile: horizontal scroll
- [ ] Empty column placeholder
- [ ] Click card → navigates to application detail
- [ ] Styles match design-brief.md

**Verification:** Drag application from "Found" to "Applied" → card moves → API called → status updated → history entry created

---

### Task 9: Frontend — Application detail page + status history timeline

**Description:** Application detail page at `/jobs/applications/[id]` showing full application info, recruiter details, notes, and status history timeline. Edit form for application fields.

**Files:**
- `frontend/src/app/(dashboard)/jobs/applications/[id]/page.tsx` — application detail page
- `frontend/src/components/jobs/application-detail.tsx` — detail view
- `frontend/src/components/jobs/application-timeline.tsx` — status history timeline
- `frontend/src/components/jobs/application-edit-dialog.tsx` — edit dialog for application fields

**Layout:**
- Header: job title + company, current status badge, action buttons (edit, change status, delete)
- Main section:
  - Notes (editable textarea or rich text)
  - Recruiter info: name, contact
  - Next action + date
  - Applied date
  - Rejection reason (if rejected)
- Sidebar or section: job summary card (link to full job detail)
- Bottom: status history timeline (ordered chronologically)

**Timeline Entry:**
- Status change: old_status → new_status with arrow, timestamp, optional comment
- Visual: colored dots per status, connecting line

**Acceptance Criteria:**
- [ ] Shows all application fields
- [ ] Edit dialog for notes, recruiter info, next action, dates
- [ ] Status change button/dropdown with optional comment
- [ ] Status history timeline shows all transitions chronologically
- [ ] Link to job detail page
- [ ] Back button to Pipeline
- [ ] Responsive layout
- [ ] Styles match design-brief.md

**Verification:** Open application detail → see all info → edit notes → change status with comment → timeline updated

---

### Task 10: Frontend — Integration polish + status change dialog

**Description:** Status change confirmation dialog (with optional comment), cross-linking between Jobs list and Pipeline, empty states, loading skeletons.

**Files:**
- `frontend/src/components/jobs/status-change-dialog.tsx` — dialog for status change with comment
- Update `jobs/page.tsx` — wire up tab switching, cross-navigation
- Update existing components — loading states, empty states, error handling

**Features:**
- Status change dialog: select new status from dropdown, optional comment textarea, confirm button
- Used both from Kanban (after drag) and from detail page
- When creating application from Jobs list, auto-navigate to Pipeline tab
- Loading skeletons for kanban and list views
- Empty states: "No jobs yet — add your first job" / "No applications — start tracking"
- Error toasts on API failures

**Acceptance Criteria:**
- [ ] Status change dialog captures optional comment → saved to status_history
- [ ] Drag-and-drop on kanban triggers status change dialog for confirmation
- [ ] Smooth navigation between Jobs tab and Pipeline tab
- [ ] Creating application from job list → application appears in Pipeline
- [ ] Loading skeletons while data fetches
- [ ] Empty state components with call to action
- [ ] Error handling with toast notifications

**Verification:** Full flow: create job → create application → drag through pipeline → check detail → all status history recorded

---

## Task Dependencies

```
Task 1 (DB schema)
  ├─ Task 2 (Jobs API)
  │    └─ Task 3 (Applications API)
  │         └─ Task 4 (Kanban + list API)
  │
  └─ (frontend, after Task 2+3+4)
     Task 5 (Types + hooks)
       ├─ Task 6 (Jobs list page)
       │    └─ Task 7 (Job dialog + detail)
       ├─ Task 8 (Applications Kanban)
       └─ Task 9 (Application detail + timeline)
            └─ Task 10 (Polish + status dialog)
```

## Execution Order
1. Task 1 (DB schema)
2. Task 2 (Jobs API)
3. Task 3 (Applications API)
4. Task 4 (Kanban + list API)
5. Task 5 (Frontend types + hooks)
6. Task 6 + Task 7 (parallel — jobs list and job detail are independent)
7. Task 8 (Applications Kanban)
8. Task 9 (Application detail + timeline)
9. Task 10 (Integration polish)
