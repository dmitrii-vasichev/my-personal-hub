# Phase 21: Frontend — Merge Application into Job (UI Migration)

**Type:** Refactoring
**Goal:** Update the entire frontend to match the Phase 20 backend refactoring where Application was merged into Job. Remove all Application-specific pages, hooks, and components. The Job entity now owns status, notes, recruiter info, status history, resumes, and cover letters directly.

## Overview

After Phase 20 merged Application into Job on the backend, the frontend still references:
- `/api/applications/*` endpoints (now `/api/jobs/*`)
- `application_id` fields (now `job_id`)
- Separate Application pages, hooks, types, and components

This phase rewires everything to use the unified Job model.

---

## Tasks

### Task 1: Update TypeScript types — merge Application into Job
**Files:** `frontend/src/types/job.ts`, `frontend/src/types/resume.ts`

**Changes to `types/job.ts`:**
1. Remove `ApplicationSummary` interface (no longer needed)
2. Update `Job` interface:
   - Remove `application?: ApplicationSummary` field
   - Add fields directly: `status?: ApplicationStatus`, `notes?: string`, `recruiter_name?: string`, `recruiter_contact?: string`, `applied_date?: string`, `next_action?: string`, `next_action_date?: string`, `rejection_reason?: string`, `status_history?: StatusHistoryEntry[]`
3. Update `StatusHistoryEntry`: `application_id` → `job_id`
4. Remove `Application` interface entirely
5. Update `KanbanCard`:
   - Remove `job_id` field and `job?: JobSummary` nested field
   - Add `title`, `company`, `location`, `match_score` directly (card IS a job now)
6. Remove `CreateApplicationInput` interface
7. Remove `UpdateApplicationInput` — merge fields into new `UpdateJobTrackingInput` (notes, recruiter_name, etc.)
8. Update `ChangeStatusInput` — stays the same but used with job ID
9. Update `JobFilters`: remove `has_application` field, add `status?: string` filter
10. Remove `ApplicationFilters` interface
11. Update `UpdateJobInput` to include tracking fields

**Changes to `types/resume.ts`:**
1. `Resume.application_id` → `Resume.job_id`
2. `CoverLetter.application_id` → `CoverLetter.job_id`

**Acceptance criteria:**
- [ ] No `Application` interface or `ApplicationSummary` exists
- [ ] Job type includes all tracking fields
- [ ] Resume/CoverLetter reference job_id
- [ ] TypeScript compiles without type errors

---

### Task 2: Rewrite use-applications hook → merge into use-jobs
**Files:** `frontend/src/hooks/use-jobs.ts`, `frontend/src/hooks/use-applications.ts` (delete)

**Changes to `use-jobs.ts`:**
1. Update `buildJobQuery`: remove `has_application` param, add `status` param
2. Add `useJobKanban()`: `GET /api/jobs/kanban` → `KanbanData`
3. Add `useStatusHistory(jobId)`: `GET /api/jobs/{id}/history` → `StatusHistoryEntry[]`
4. Add `useChangeJobStatus()`: `PATCH /api/jobs/{id}/status` with optimistic kanban update (port logic from use-applications)
5. Add `useUpdateJobTracking()`: `PATCH /api/jobs/{id}/tracking` (notes, recruiter, etc.)
6. Remove old `APPLICATIONS_KEY` invalidations from existing mutations

**Delete `use-applications.ts`** entirely.

**Acceptance criteria:**
- [ ] All application functionality available via use-jobs hooks
- [ ] Kanban drag-and-drop optimistic update works with job IDs
- [ ] use-applications.ts deleted
- [ ] No import errors

---

### Task 3: Update use-resumes hook — application_id → job_id
**Files:** `frontend/src/hooks/use-resumes.ts`

**Changes:**
1. `useResumes(applicationId)` → `useResumes(jobId)`: endpoint `/api/resumes/job/{jobId}`
2. `useGenerateResume()`: body `{ application_id }` → `{ job_id }`
3. `useRunAtsAudit()`: invalidate by `data.job_id` instead of `data.application_id`
4. `useRunGapAnalysis()`: same change
5. `useCoverLetters(applicationId)` → `useCoverLetters(jobId)`: endpoint `/api/cover-letters/job/{jobId}`
6. `useGenerateCoverLetter()`: body `{ application_id }` → `{ job_id }`

**Acceptance criteria:**
- [ ] All resume/cover letter hooks use job_id
- [ ] API endpoints point to `/api/resumes/job/` and `/api/cover-letters/job/`

---

### Task 4: Merge Application detail into Job detail page
**Files:** `frontend/src/components/jobs/job-detail.tsx`

**Changes:**
1. Remove `useCreateApplication` import — tracking is now intrinsic to Job
2. Remove `handleStartTracking` — replace with `useChangeJobStatus` to set initial status
3. Sidebar "Application" section:
   - If `job.status` exists → show status badge + "Change Status" button + edit tracking link
   - If `job.status` is null → show "Start Tracking" button that sets status to "found"
4. Remove link to `/jobs/applications/{id}` — all info is on the job page now
5. Add sections below description (from old ApplicationDetail):
   - Notes section (if `job.notes`)
   - Recruiter section (if `job.recruiter_name` or `job.recruiter_contact`)
   - Next action section (if `job.next_action`)
   - Applied date section (if `job.applied_date`)
   - Rejection reason (if terminal status + reason)
6. Add Resume section: `<ResumeSection jobId={job.id} />` (only if job.status exists)
7. Add Cover Letter section: `<CoverLetterSection jobId={job.id} />` (only if job.status exists)
8. Add Status History timeline (only if job.status exists)

**Acceptance criteria:**
- [ ] Job detail page shows all tracking info inline
- [ ] No link to separate application page
- [ ] Resume/cover letter sections work with jobId
- [ ] Start Tracking sets status via PATCH /api/jobs/{id}/status

---

### Task 5: Update StatusChangeDialog — applicationId → jobId
**Files:** `frontend/src/components/jobs/status-change-dialog.tsx`

**Changes:**
1. Prop `applicationId` → `jobId`
2. Import `useChangeJobStatus` from `use-jobs` instead of `useChangeApplicationStatus` from `use-applications`
3. Mutation call: `changeStatus.mutateAsync({ id: jobId, data: { ... } })`
4. Update all call sites in job-detail.tsx and application-kanban.tsx

**Acceptance criteria:**
- [ ] Dialog works with job IDs
- [ ] No reference to application hooks

---

### Task 6: Update ApplicationEditDialog → JobTrackingEditDialog
**Files:** `frontend/src/components/jobs/application-edit-dialog.tsx` (rename/refactor)

**Changes:**
1. Rename component `ApplicationEditDialog` → `JobTrackingEditDialog`
2. Rename file to `job-tracking-edit-dialog.tsx`
3. Props: `application: Application` → `job: Job`
4. Import `useUpdateJobTracking` from `use-jobs` instead of `useUpdateApplication`
5. Mutation: `updateJobTracking.mutateAsync({ id: job.id, data: { ... } })`
6. Read initial values from `job.notes`, `job.recruiter_name`, etc.
7. Dialog title: "Edit Application" → "Edit Tracking Info"

**Acceptance criteria:**
- [ ] Dialog works with Job data
- [ ] Old file deleted, new file in place
- [ ] All call sites updated

---

### Task 7: Update Kanban components — use job data directly
**Files:** `frontend/src/components/jobs/application-kanban.tsx`, `frontend/src/components/jobs/application-column.tsx`, `frontend/src/components/jobs/application-card.tsx`

**Changes to application-kanban.tsx:**
1. Import `useJobKanban` from `use-jobs` instead of `useApplicationKanban` from `use-applications`
2. `StatusChangeDialog` prop: `applicationId` → `jobId` (= `pendingChange.cardId`)
3. Keep file name for now or rename to `job-kanban.tsx`

**Changes to application-card.tsx:**
1. Navigation: `/jobs/applications/${card.id}` → `/jobs/${card.id}`
2. Access card data directly: `card.title` instead of `card.job?.title`, `card.company` instead of `card.job?.company`, etc.
3. Match score: `card.match_score` instead of `card.job?.match_score`

**Changes to application-column.tsx:**
1. Update import if card component renamed

**Acceptance criteria:**
- [ ] Kanban loads from `/api/jobs/kanban`
- [ ] Cards navigate to `/jobs/{id}` (job detail page)
- [ ] Card data accessed directly from card object

---

### Task 8: Update ResumeSection and CoverLetterSection — applicationId → jobId
**Files:** `frontend/src/components/jobs/resume-section.tsx`, `frontend/src/components/jobs/cover-letter-section.tsx`

**Changes to resume-section.tsx:**
1. Prop `applicationId` → `jobId`
2. `useResumes(jobId)` (hook already updated in Task 3)
3. `generate.mutateAsync(jobId)`

**Changes to cover-letter-section.tsx:**
1. Prop `applicationId` → `jobId`
2. `useCoverLetters(jobId)`
3. `generate.mutateAsync(jobId)`

**Acceptance criteria:**
- [ ] Both sections accept `jobId` prop
- [ ] Generation calls pass `jobId`

---

### Task 9: Update dashboard RecentActivity — remove application dependency
**Files:** `frontend/src/components/dashboard/recent-activity.tsx`

**Changes:**
1. Remove `useApplications` import
2. Replace application activity items with job-based activity:
   - Use `useJobs({ status: 'applied,screening,technical_interview,final_interview,offer' })` or similar to get tracked jobs
   - Activity label: `${job.title} — ${job.status}`
   - Link: `/jobs/${job.id}` instead of `/jobs/applications/${app.id}`
3. Update empty state text: "Add Application" → "Track a Job"

**Acceptance criteria:**
- [ ] No import from use-applications
- [ ] Job activity links to /jobs/{id}
- [ ] Dashboard renders without errors

---

### Task 10: Delete Application page and clean up dead code
**Files to delete:**
- `frontend/src/app/(dashboard)/jobs/applications/[id]/page.tsx`
- `frontend/src/components/jobs/application-detail.tsx`
- `frontend/src/components/jobs/application-timeline.tsx` (move to `job-timeline.tsx` or inline)

**Other cleanup:**
1. In `jobs/page.tsx`: if `ApplicationKanban` was renamed → update import
2. Remove any remaining `use-applications` imports across codebase
3. Grep for "application" in component files to catch stragglers

**Acceptance criteria:**
- [ ] Application page route deleted
- [ ] Application-specific components deleted or renamed
- [ ] No dead imports
- [ ] `npm run build` succeeds
- [ ] `npm run lint` passes

---

### Task 11: Update jobs-table.tsx — show status from Job directly
**Files:** `frontend/src/components/jobs/jobs-table.tsx`

**Changes:**
1. Status column: read `job.status` directly instead of `job.application?.status`
2. Remove any `has_application` logic
3. Ensure status badge renders correctly for jobs with `status: null` (show "—" or empty)

**Acceptance criteria:**
- [ ] Table shows job status from Job.status field
- [ ] Jobs without status show appropriate placeholder
- [ ] Sorting by status works

---

### Task 12: Update job-filters.tsx — replace has_application with status filter
**Files:** `frontend/src/components/jobs/job-filters.tsx`, `frontend/src/hooks/use-jobs.ts`

**Changes:**
1. Remove `has_application` toggle/filter
2. Add status filter dropdown (multi-select or single) using ApplicationStatus values
3. Update `JobFilters` type (done in Task 1) and `buildJobQuery` in use-jobs

**Acceptance criteria:**
- [ ] Status filter works with backend
- [ ] No has_application filter remains
- [ ] Filter UI consistent with design brief

---

### Task 13: Frontend tests — update for merged entity
**Files:** `frontend/src/__tests__/**/*.test.*`

**Changes:**
1. Update any test fixtures that reference Application type → use Job with status
2. Update mock API calls from `/api/applications/*` → `/api/jobs/*`
3. Update `application_id` → `job_id` in resume/cover letter test data
4. Add test: job detail page renders tracking info when status exists
5. Add test: kanban loads from /api/jobs/kanban
6. Verify: `npm test` passes

**Acceptance criteria:**
- [ ] All existing tests updated and passing
- [ ] New tests for merged functionality
- [ ] `npm test` green

---

## Execution order

```
Task 1 (types) → Task 2 (use-jobs hook) → Task 3 (use-resumes hook)
→ Task 5 (StatusChangeDialog) → Task 6 (TrackingEditDialog) → Task 8 (Resume/CL sections)
→ Task 4 (job-detail merge) → Task 7 (kanban components) → Task 9 (dashboard)
→ Task 11 (jobs-table) → Task 12 (job-filters) → Task 10 (delete dead code)
→ Task 13 (tests)
```

Tasks 1-3 are foundational (types + hooks). Tasks 4-9 update components. Tasks 10-12 clean up. Task 13 verifies.

## Risks
- KanbanCard structure changed — verify backend returns flat job data (title, company directly on card)
- Resume/cover letter generation depends on job having a status — frontend should gate these sections
- Dashboard RecentActivity loses application data — needs graceful fallback to job-based activity
- `/jobs/applications/[id]` bookmarks will 404 — no redirect mechanism (acceptable)
