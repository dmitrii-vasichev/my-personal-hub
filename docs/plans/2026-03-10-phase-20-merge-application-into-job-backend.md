# Phase 20: Merge Application into Job — Backend

**Issue:** #247
**Type:** Refactoring
**Goal:** Merge the `Application` entity into `Job` to create a single unified model. Remove Application as a separate DB table, API, and service layer.

## Overview

Currently Job and Application are separate entities (separate tables, APIs, pages). This refactoring merges all Application fields and logic into Job, eliminating unnecessary complexity.

### Key decisions
- Job gets a `status` field (ApplicationStatus enum, nullable — null means "no tracking yet")
- Job gets all Application fields: notes, recruiter_name, recruiter_contact, applied_date, next_action, next_action_date, rejection_reason
- StatusHistory FK changes from `application_id` → `job_id`
- Resume/CoverLetter FK changes from `application_id` → `job_id`
- Application table is dropped
- All `/api/applications/*` endpoints are merged into `/api/jobs/*`

---

## Tasks

### Task 1: Alembic migration — merge Application columns into Job
**Files:** `backend/alembic/versions/015_merge_application_into_job.py`

**Steps:**
1. Add new columns to `jobs` table:
   - `status` (Enum applicationstatus, nullable, default null)
   - `notes` (Text, nullable)
   - `recruiter_name` (String 255, nullable)
   - `recruiter_contact` (String 255, nullable)
   - `applied_date` (Date, nullable)
   - `next_action` (String 255, nullable)
   - `next_action_date` (Date, nullable)
   - `rejection_reason` (Text, nullable)
2. Add `job_id` column to `status_history` (Integer, FK → jobs.id, nullable temporarily)
3. Add `job_id` column to `resumes` (Integer, FK → jobs.id, nullable temporarily)
4. Add `job_id` column to `cover_letters` (Integer, FK → jobs.id, nullable temporarily)
5. Migrate data:
   - Copy Application fields into corresponding Job rows: `UPDATE jobs SET status = a.status, notes = a.notes, ... FROM applications a WHERE a.job_id = jobs.id`
   - Copy `status_history.application_id` → `status_history.job_id` via applications join
   - Copy `resumes.application_id` → `resumes.job_id` via applications join
   - Copy `cover_letters.application_id` → `cover_letters.job_id` via applications join
6. Make `job_id` NOT NULL on status_history, resumes, cover_letters
7. Drop old `application_id` FK and column from status_history, resumes, cover_letters
8. Drop `applications` table
9. Add index: `ix_jobs_user_status` on jobs(user_id, status)
10. Add index: `ix_status_history_job_id` on status_history(job_id)

**Acceptance criteria:**
- [ ] Migration runs without errors on existing data
- [ ] Jobs that had an Application now have status, notes, etc. populated
- [ ] StatusHistory, Resume, CoverLetter now reference job_id
- [ ] applications table is gone
- [ ] Downgrade works (recreates applications table)

**Verification:** `alembic upgrade head` + `alembic downgrade -1` + `alembic upgrade head`

---

### Task 2: Update Job model — absorb Application fields
**Files:** `backend/app/models/job.py`

**Changes:**
1. Add to Job model:
   - `status: Mapped[Optional[ApplicationStatus]]` (nullable, default None)
   - `notes`, `recruiter_name`, `recruiter_contact`, `applied_date`, `next_action`, `next_action_date`, `rejection_reason`
   - `status_history` relationship (cascade delete-orphan)
   - `resumes` relationship (cascade delete-orphan)
   - `cover_letters` relationship (cascade delete-orphan)
2. Remove `applications` relationship from Job
3. Delete entire `Application` class
4. Update `StatusHistory`: change `application_id` → `job_id`, FK → jobs.id, relationship back_populates="status_history" on Job
5. Add `__table_args__` index on (user_id, status) to Job

**Acceptance criteria:**
- [ ] Job model has all Application fields
- [ ] Application class is removed
- [ ] StatusHistory references job_id
- [ ] No import errors

---

### Task 3: Update Resume/CoverLetter model — FK to Job
**Files:** `backend/app/models/resume.py`

**Changes:**
1. Resume: change `application_id` → `job_id`, FK → jobs.id
2. Resume: change `application` relationship → `job` relationship back_populates="resumes"
3. CoverLetter: same changes
4. Remove Application import

**Acceptance criteria:**
- [ ] Resume.job_id and CoverLetter.job_id exist
- [ ] Relationships point to Job

---

### Task 4: Update models/__init__.py
**Files:** `backend/app/models/__init__.py`

**Changes:**
- Remove `Application` export (class is gone)
- Keep `ApplicationStatus` export (enum still used)
- Keep `StatusHistory` export

---

### Task 5: Update schemas — merge into job schemas
**Files:** `backend/app/schemas/job.py`, `backend/app/schemas/application.py`

**Changes to job.py:**
1. Add to `JobCreate`: optional `status` field (default None — new jobs start without tracking)
2. Add to `JobUpdate`: all tracking fields (status, notes, recruiter_name, etc.)
3. Add `JobStatusChange` schema (new_status, comment)
4. Add to `JobResponse`: status, notes, recruiter_name, recruiter_contact, applied_date, next_action, next_action_date, rejection_reason, status_history list
5. Add `KanbanCardResponse`: job card for kanban (id, title, company, location, status, match_score, applied_date, next_action, next_action_date, updated_at)
6. Add `KanbanResponse`: 12 status columns with KanbanCardResponse lists
7. Move `StatusHistoryResponse` here (change application_id → job_id)
8. Remove `ApplicationSummary` — no longer needed

**Changes to application.py:**
- Delete entire file (all schemas moved to job.py)

**Acceptance criteria:**
- [ ] JobResponse includes all tracking fields
- [ ] KanbanResponse uses job-based cards
- [ ] application.py deleted
- [ ] No import errors

---

### Task 6: Update job service — absorb application logic
**Files:** `backend/app/services/job.py`

**Changes:**
1. Remove `_get_user_application`, `_attach_application` helpers
2. Update `_load_job` to eagerly load `status_history` when needed
3. Update `create_job`: if status is provided, create initial StatusHistory entry
4. Update `get_job`: no more application lookup
5. Update `list_jobs`:
   - Remove `has_application` filter
   - Add `status` filter (comma-separated, filter on Job.status)
   - No more application attachment loop
6. Add `change_status(db, job_id, data, current_user)`:
   - Auto-set applied_date when transitioning to "applied"
   - Create StatusHistory entry
7. Add `get_kanban(db, current_user)`: group jobs by status (only jobs with non-null status)
8. Add `get_history(db, job_id, current_user)`: return status history for a job
9. Add `update_job_tracking(db, job_id, data, current_user)`: update notes, recruiter, etc.

**Acceptance criteria:**
- [ ] All application logic merged into job service
- [ ] Kanban returns jobs grouped by status
- [ ] Status changes create history entries
- [ ] Access control preserved

---

### Task 7: Delete application service
**Files:** `backend/app/services/application.py`

**Changes:**
- Delete entire file

---

### Task 8: Update job API — absorb application endpoints
**Files:** `backend/app/api/jobs.py`

**New endpoints (merged from applications API):**
- `GET /api/jobs/kanban` — kanban board (jobs grouped by status)
- `PATCH /api/jobs/{id}/status` — change job status (with comment)
- `GET /api/jobs/{id}/history` — status change history
- `PATCH /api/jobs/{id}/tracking` — update tracking fields (notes, recruiter, etc.)

**Updated endpoints:**
- `GET /api/jobs` — add `status` query param, remove `has_application`
- `GET /api/jobs/{id}` — response now includes all tracking fields

**Acceptance criteria:**
- [ ] All application endpoints available under /api/jobs/
- [ ] Old application-specific endpoints no longer exist
- [ ] Kanban endpoint returns job cards

---

### Task 9: Delete application API + update main.py
**Files:** `backend/app/api/applications.py`, `backend/app/main.py`

**Changes:**
1. Delete `backend/app/api/applications.py`
2. Remove `applications_router` import and include from `main.py`

---

### Task 10: Update resume/cover letter service and API
**Files:** `backend/app/services/resume.py`, `backend/app/api/resumes.py`, `backend/app/api/cover_letters.py`, `backend/app/schemas/resume.py`

**Changes to service:**
1. `_get_app_with_job` → `_get_job` (simpler — just load Job by id + user check)
2. `generate_resume(db, user, job_id)` — parameter change
3. `get_resumes(db, user, job_id)` — query by Resume.job_id
4. `get_resume` ownership check: via Resume.job.user_id
5. `run_ats_audit` and `run_gap_analysis`: load job via resume.job (not resume.application.job)
6. `generate_cover_letter(db, user, job_id)` — parameter change
7. `get_cover_letters(db, user, job_id)` — query by CoverLetter.job_id
8. `_next_version` — query by model.job_id

**Changes to API:**
- `POST /api/resumes/generate` body: `job_id` instead of `application_id`
- `GET /api/resumes/job/{job_id}` instead of `/api/resumes/application/{application_id}`
- `POST /api/cover-letters/generate` body: `job_id`
- `GET /api/cover-letters/job/{job_id}` instead of `application/{application_id}`

**Changes to schemas:**
- `ResumeGenerateRequest.application_id` → `job_id`
- `CoverLetterGenerateRequest.application_id` → `job_id`
- `ResumeResponse.application_id` → `job_id`
- `CoverLetterResponse.application_id` → `job_id`

---

### Task 11: Update dashboard and analytics services
**Files:** `backend/app/services/dashboard.py`, `backend/app/services/analytics.py`

**Changes to dashboard.py:**
- Query `Job` table instead of `Application` for active_applications count
- Filter: `Job.status IS NOT NULL AND Job.status NOT IN (terminal statuses)`
- Interview count: `Job.status IN (technical_interview, final_interview)`

**Changes to analytics.py:**
- `get_funnel`: query Job.status instead of Application.status
- `get_timeline`: query Job.created_at where Job.status IS NOT NULL
- `get_response_rates`: query Job.status
- `get_ats_scores`: join Resume on Resume.job_id = Job.id
- `get_summary`: count jobs with status (not applications)

---

### Task 12: Update backend tests
**Files:** `backend/tests/test_*.py`

**Changes:**
- Update all tests that create/query Applications → use Job with status field instead
- Update visibility/access control tests for jobs with status
- Update dashboard tests for new query structure
- Remove any Application-specific test fixtures
- Add tests for new endpoints: `PATCH /api/jobs/{id}/status`, `GET /api/jobs/kanban`, `GET /api/jobs/{id}/history`

**Acceptance criteria:**
- [ ] All existing tests pass (adapted)
- [ ] New endpoint tests added
- [ ] `pytest` green, `ruff check` clean

---

## Execution order

```
Task 1 (migration) → Task 2 (job model) → Task 3 (resume model) → Task 4 (init)
→ Task 5 (schemas) → Task 6 (job service) → Task 7 (delete app service)
→ Task 8 (job API) → Task 9 (delete app API) → Task 10 (resume service/API)
→ Task 11 (dashboard/analytics) → Task 12 (tests)
```

All tasks are sequential — each depends on the previous.

## Risks
- Data migration must be correct — Application data must not be lost
- Resume generation heavily depends on Application→Job chain — must verify after refactoring
- ATS audit and gap analysis navigate resume.application.job — must update to resume.job
