# Phase 18: Job Matching & Linking

**Date**: 2026-03-10
**PRD Reference**: docs/prd-job-hunt-redesign.md
**Requirements**: FR-7 (AI Job Matching), FR-12 (Job ↔ Task Linking), FR-13 (Job ↔ Calendar Event Linking), FR-3 complete (Job Detail Page)
**Issues**: #220, #221, #222, #223, #224, #225, #226, #227, #228, #229, #230

## Overview

Add AI-powered job matching (compares user profile against job description to produce match score + breakdown), job-task and job-event linking (many-to-many), and complete the job detail page with match result display and linked items sections.

## Current State

- Job model: has `match_score` (int) and `match_result` (JSON) fields — added in Phase 15 migration 012, currently unpopulated
- UserProfile model + service: complete CRUD + AI import (Phase 15)
- AiKnowledgeBase: 4 default docs seeded, CRUD API (Phase 15)
- Prompt assembly service: supports resume_generation, ats_audit, gap_analysis, cover_letter — NOT job_matching yet
- LLM multi-provider: OpenAI, Anthropic, Gemini adapters (services/ai.py)
- TaskEventLink: existing many-to-many pattern to follow (Phase 5)
- Job detail page: 2-column layout, shows match_score badge but NOT detailed match result; no linked tasks/events sections
- Frontend hooks: useJob, useUpdateJob, useTasks, useCalendarEvents exist; no job linking hooks

## Tasks

### Task 1: DB Migration — job_task_links and job_event_links tables

**Description**: Create Alembic migration that adds two many-to-many linking tables following the existing `task_event_links` pattern.

**Files**:
- `backend/alembic/versions/014_create_job_link_tables.py` (new)

**Schema**:
```
job_task_links:
  id: int PK
  job_id: int FK→jobs (CASCADE)
  task_id: int FK→tasks (CASCADE)
  unique(job_id, task_id)
  index on job_id, index on task_id

job_event_links:
  id: int PK
  job_id: int FK→jobs (CASCADE)
  event_id: int FK→calendar_events (CASCADE)
  unique(job_id, event_id)
  index on job_id, index on event_id
```

**Acceptance Criteria**:
- [ ] Migration runs without errors (upgrade + downgrade)
- [ ] Unique constraints prevent duplicate links
- [ ] Cascade deletes work (deleting a job removes its links)
- [ ] Existing data not affected

**Verification**: `alembic upgrade head && alembic downgrade -1 && alembic upgrade head`

---

### Task 2: JobTaskLink and JobEventLink models

**Description**: Create SQLAlchemy models for the two linking tables. Follow the exact pattern from `task_event_link.py`. Register in `__init__.py`.

**Dependencies**: Task 1

**Files**:
- `backend/app/models/job_task_link.py` (new)
- `backend/app/models/job_event_link.py` (new)
- `backend/app/models/__init__.py` (edit — add imports)

**Model pattern** (from TaskEventLink):
```python
class JobTaskLink(Base):
    __tablename__ = "job_task_links"
    id: Mapped[int] = mapped_column(primary_key=True)
    job_id: Mapped[int] = mapped_column(Integer, ForeignKey("jobs.id", ondelete="CASCADE"))
    task_id: Mapped[int] = mapped_column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"))
    __table_args__ = (UniqueConstraint("job_id", "task_id", name="uq_job_task"),)
```

**Acceptance Criteria**:
- [ ] Models match migration schema
- [ ] Exported from models/__init__.py
- [ ] No import errors

**Verification**: `python -c "from app.models import JobTaskLink, JobEventLink"`

---

### Task 3: Job linking services (job_task_link.py + job_event_link.py)

**Description**: Create service modules for linking/unlinking jobs with tasks and events. Follow the `task_event_link.py` pattern: validate access, check existence, handle idempotency.

**Dependencies**: Task 2

**Files**:
- `backend/app/services/job_task_link.py` (new)
- `backend/app/services/job_event_link.py` (new)

**Functions for job_task_link.py**:
- `link_job_task(db, job_id, task_id, user) → bool` — link task to job
- `unlink_job_task(db, job_id, task_id, user) → bool` — unlink task from job
- `get_job_linked_tasks(db, job_id, user) → Optional[list[Task]]` — get tasks linked to a job
- `get_task_linked_jobs(db, task_id, user) → Optional[list[Job]]` — get jobs linked to a task (bonus, useful later)

**Functions for job_event_link.py**:
- `link_job_event(db, job_id, event_id, user) → bool`
- `unlink_job_event(db, job_id, event_id, user) → bool`
- `get_job_linked_events(db, job_id, user) → Optional[list[CalendarEvent]]`

**Access control**: User must own both the job AND the task/event to create a link. Admin can link any.

**Acceptance Criteria**:
- [ ] Link/unlink works correctly
- [ ] Idempotent (linking twice returns True, not error)
- [ ] Access control enforced (403 if not authorized)
- [ ] Returns None if job not found, empty list if no links

**Verification**: Unit tests (Task 9)

---

### Task 4: Job linking API endpoints

**Description**: Add API endpoints for linking/unlinking tasks and events to jobs. Add to the existing `jobs.py` router.

**Dependencies**: Task 3

**Files**:
- `backend/app/api/jobs.py` (edit — add 7 new endpoints)
- `backend/app/schemas/job.py` (edit — add LinkedTaskBrief, LinkedEventBrief response schemas)

**Endpoints**:
- `POST /api/jobs/{job_id}/link-task/{task_id}` → 200 OK / 404 Not Found
- `DELETE /api/jobs/{job_id}/link-task/{task_id}` → 200 OK / 404 Not Found
- `GET /api/jobs/{job_id}/linked-tasks` → list[LinkedTaskBrief]
- `POST /api/jobs/{job_id}/link-event/{event_id}` → 200 OK / 404 Not Found
- `DELETE /api/jobs/{job_id}/link-event/{event_id}` → 200 OK / 404 Not Found
- `GET /api/jobs/{job_id}/linked-events` → list[LinkedEventBrief]

**Schemas**:
```python
class LinkedTaskBrief(BaseModel):
    id: int
    title: str
    status: str
    priority: str

class LinkedEventBrief(BaseModel):
    id: int
    title: str
    start_time: datetime
    end_time: datetime
```

**Acceptance Criteria**:
- [ ] All 6 endpoints work correctly
- [ ] Proper HTTP status codes (200, 404, 403)
- [ ] Brief schemas return minimal data
- [ ] OpenAPI docs show all endpoints

**Verification**: Manual curl + automated tests

---

### Task 5: AI Job Matching — backend service + endpoint

**Description**: Create the AI job matching service and API endpoint. The match endpoint reads the user's profile, assembles a prompt with the job description, calls the LLM, and saves the match result (score + breakdown) to the job record.

**Dependencies**: Tasks 1-2 (for complete backend setup), existing prompt_assembly.py

**Files**:
- `backend/app/services/job_matching.py` (new)
- `backend/app/services/prompt_assembly.py` (edit — add "job_matching" operation)
- `backend/app/api/jobs.py` (edit — add match endpoint)
- `backend/app/schemas/job.py` (edit — add MatchResult schema)

**Service function**:
```python
async def match_job(db, job_id, current_user) → dict:
    # 1. Get job (validate access)
    # 2. Get user profile (error if missing)
    # 3. Assemble prompt via prompt_assembly with operation="job_matching"
    # 4. Call LLM
    # 5. Parse JSON response into match_result structure
    # 6. Save match_score and match_result to job
    # 7. Return match_result
```

**Match result structure**:
```json
{
  "score": 85,
  "matched_skills": ["Python", "FastAPI", "PostgreSQL"],
  "missing_skills": ["Kubernetes", "Terraform"],
  "strengths": ["Strong backend experience", "Relevant frameworks"],
  "recommendations": ["Study Kubernetes basics", "Review Terraform docs"]
}
```

**Prompt assembly changes**:
- Add `"job_matching"` to DEFAULT_INSTRUCTIONS with instruction like: "Analyze the match between the candidate profile and the job description. Return a JSON with score (0-100), matched_skills, missing_skills, strengths, and recommendations."
- The prompt context will include: user_profile (skills, experience, education, summary) + job description + job title + company

**API endpoint**:
- `POST /api/jobs/{job_id}/match` → MatchResultResponse
- Returns 404 if job not found, 400 if no user profile, 500 if LLM fails

**Acceptance Criteria**:
- [ ] Match endpoint calls LLM with user profile + job description
- [ ] Returns score 0-100 and detailed breakdown
- [ ] Saves match_score and match_result to Job record
- [ ] Returns 400 if user has no profile
- [ ] Handles LLM errors gracefully (timeout, invalid JSON)
- [ ] Uses existing prompt_assembly service

**Verification**: Manual test with real job + profile, mock test in automated suite

---

### Task 6: Frontend types and hooks for matching and linking

**Description**: Create TypeScript types and React Query hooks for the new API endpoints. Follow the existing `use-task-event-links.ts` pattern for linking hooks and add a match hook.

**Files**:
- `frontend/src/types/job.ts` (edit — add MatchResult, LinkedTaskBrief, LinkedEventBrief)
- `frontend/src/hooks/use-job-links.ts` (new — linking hooks)
- `frontend/src/hooks/use-job-match.ts` (new — match hook)

**Types to add to job.ts**:
```typescript
interface MatchResult {
  score: number
  matched_skills: string[]
  missing_skills: string[]
  strengths: string[]
  recommendations: string[]
}

interface LinkedTaskBrief {
  id: number
  title: string
  status: string
  priority: string
}

interface LinkedEventBrief {
  id: number
  title: string
  start_time: string
  end_time: string
}
```

**Hooks in use-job-links.ts**:
- `useJobLinkedTasks(jobId)` — GET /api/jobs/{id}/linked-tasks
- `useJobLinkedEvents(jobId)` — GET /api/jobs/{id}/linked-events
- `useLinkJobToTask(jobId)` — POST /api/jobs/{id}/link-task/{taskId}
- `useUnlinkJobFromTask(jobId)` — DELETE /api/jobs/{id}/link-task/{taskId}
- `useLinkJobToEvent(jobId)` — POST /api/jobs/{id}/link-event/{eventId}
- `useUnlinkJobFromEvent(jobId)` — DELETE /api/jobs/{id}/link-event/{eventId}

**Hooks in use-job-match.ts**:
- `useRunJobMatch(jobId)` — POST /api/jobs/{id}/match (mutation)

**Acceptance Criteria**:
- [ ] Types match backend schemas
- [ ] Hooks follow existing patterns (query keys, invalidation)
- [ ] Match mutation invalidates the job query on success
- [ ] Link/unlink mutations invalidate linked-tasks/linked-events queries
- [ ] No TypeScript errors

**Verification**: `npx tsc --noEmit`

---

### Task 7: Job Match Section component

**Description**: Create a component that displays the AI match result on the job detail page. Shows "Run Match" button (if no result yet), loading state during matching, and detailed result display (score, matched/missing skills, strengths, recommendations).

**Dependencies**: Tasks 5, 6

**Files**:
- `frontend/src/components/jobs/job-match-section.tsx` (new)

**Component behavior**:
- If no match_result: show "Run Match" button
- If match_result exists: show detailed breakdown
  - Overall score as large badge (color-coded)
  - Matched skills as green tags
  - Missing skills as red/amber tags
  - Strengths as bulleted list
  - Recommendations as bulleted list
- "Re-run Match" button to update result
- Loading spinner while LLM processes
- Error message if matching fails (no profile, LLM error)

**Props**: `job: Job` (reads match_score, match_result from job data)

**Acceptance Criteria**:
- [ ] "Run Match" button visible when no match result
- [ ] Clicking triggers API call with loading state
- [ ] Success displays detailed breakdown
- [ ] Re-run button available after first match
- [ ] Error handling for missing profile (show message to set up profile)
- [ ] Error handling for LLM failure
- [ ] Follows design-brief.md styling

**Verification**: Visual check — run match on a job with profile set up

---

### Task 8: Linked Items Section components

**Description**: Create components for displaying and managing linked tasks and calendar events on the job detail page. Each section shows a list of linked items with unlink capability and a dialog to link new items.

**Dependencies**: Task 6

**Files**:
- `frontend/src/components/jobs/linked-tasks-section.tsx` (new)
- `frontend/src/components/jobs/linked-events-section.tsx` (new)

**LinkedTasksSection component**:
- Header: "Linked Tasks" with count badge and "Link Task" button
- List of linked tasks: title, status badge, priority badge
- Click on task → navigate to task detail (or no navigation, just display)
- Unlink button (X icon) per task
- "Link Task" dialog: shows user's tasks (filterable), click to link
- Empty state: "No tasks linked" + prompt to link one

**LinkedEventsSection component**:
- Header: "Linked Events" with count badge and "Link Event" button
- List of linked events: title, date/time
- Unlink button (X icon) per event
- "Link Event" dialog: shows user's upcoming events (filterable), click to link
- Empty state: "No events linked" + prompt to link one

**Acceptance Criteria**:
- [ ] Both sections render linked items correctly
- [ ] Link dialog opens and shows available tasks/events
- [ ] Linking adds item to list immediately (query invalidation)
- [ ] Unlink removes item with confirmation
- [ ] Empty states shown when no links
- [ ] Follows design-brief.md styling

**Verification**: Visual check — link/unlink tasks and events to a job

---

### Task 9: Integrate sections into job detail page

**Description**: Update the job detail page to include the match section, linked tasks section, and linked events section. Place match section prominently (below description or in a dedicated area), and linked items in the left column below existing content.

**Dependencies**: Tasks 7, 8

**Files**:
- `frontend/src/components/jobs/job-detail.tsx` (edit)

**Layout changes**:
- Left column (main content), top to bottom:
  1. Description section (existing)
  2. **Match Result section** (new — JobMatchSection)
  3. Job Posting / source URL (existing)
  4. Tags (existing)
  5. **Linked Tasks section** (new — LinkedTasksSection)
  6. **Linked Events section** (new — LinkedEventsSection)
- Right sidebar: unchanged (application status, metadata)

**Acceptance Criteria**:
- [ ] All three new sections visible on job detail page
- [ ] Sections load correctly (loading states for async data)
- [ ] Page layout not broken
- [ ] Responsive on mobile (sections stack vertically)
- [ ] No regressions in existing functionality

**Verification**: Visual check — navigate to job detail, verify all sections present

---

### Task 10: Backend tests for matching and linking

**Description**: Write comprehensive backend tests for job matching and job linking functionality.

**Dependencies**: Tasks 3, 4, 5

**Files**:
- `backend/tests/test_job_matching.py` (new)
- `backend/tests/test_job_links.py` (new)

**Test cases — job matching**:
- Match endpoint returns score and breakdown (mock LLM)
- Match fails with 400 if no user profile
- Match saves result to job record
- Match updates existing result on re-run
- Match handles invalid LLM response gracefully

**Test cases — job-task linking**:
- Link task to job succeeds
- Link duplicate returns success (idempotent)
- Unlink task from job succeeds
- Get linked tasks returns correct list
- Cannot link task from another user
- Deleting job cascades to links

**Test cases — job-event linking**:
- Link event to job succeeds
- Unlink event from job succeeds
- Get linked events returns correct list
- Cannot link event from another user

**Acceptance Criteria**:
- [ ] All tests pass
- [ ] LLM calls mocked (no real API calls)
- [ ] Access control tested
- [ ] Idempotency tested
- [ ] All existing tests still pass

**Verification**: `cd backend && python -m pytest tests/test_job_matching.py tests/test_job_links.py -v`

---

### Task 11: Frontend tests for new components

**Description**: Write frontend tests for the match section, linked items sections, and hooks.

**Dependencies**: Tasks 7, 8, 9

**Files**:
- `frontend/__tests__/job-match-section.test.tsx` (new)
- `frontend/__tests__/job-linked-items.test.tsx` (new)

**Test cases**:
- JobMatchSection renders "Run Match" when no result
- JobMatchSection renders match breakdown when result exists
- JobMatchSection shows loading during match
- LinkedTasksSection renders linked tasks
- LinkedTasksSection opens link dialog
- LinkedEventsSection renders linked events
- LinkedEventsSection opens link dialog

**Acceptance Criteria**:
- [ ] All tests pass
- [ ] API calls mocked
- [ ] Key interactions covered

**Verification**: `cd frontend && npm test`

---

## Task Dependency Graph

```
Task 1 (migration)
  └── Task 2 (models)
        └── Task 3 (linking services)
              └── Task 4 (linking API endpoints)

Task 5 (match service + endpoint) — depends on existing infrastructure

Task 6 (frontend types + hooks) — depends on Tasks 4, 5

Task 7 (match section component) — depends on Task 6
Task 8 (linked items components) — depends on Task 6

Task 9 (integrate into detail page) — depends on Tasks 7, 8

Task 10 (backend tests) — depends on Tasks 3, 4, 5
Task 11 (frontend tests) — depends on Tasks 7, 8, 9
```

## Execution Order

1. Task 1 — Migration (job_task_links + job_event_links)
2. Task 2 — Models (JobTaskLink + JobEventLink)
3. Task 3 — Linking services
4. Task 4 — Linking API endpoints
5. Task 5 — AI Job Matching (service + endpoint + prompt assembly)
6. Task 6 — Frontend types + hooks
7. Task 7 — Match section component
8. Task 8 — Linked items section components
9. Task 9 — Integrate into job detail page
10. Task 10 — Backend tests
11. Task 11 — Frontend tests

Tasks 3+5 can potentially run in parallel (after Task 2).
Tasks 7+8 can run in parallel (after Task 6).
Tasks 10+11 can run in parallel.
