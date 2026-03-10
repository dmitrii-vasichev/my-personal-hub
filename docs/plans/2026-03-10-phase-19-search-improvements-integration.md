# Phase 19: Search Improvements & Integration

**Date**: 2026-03-10
**PRD Reference**: docs/prd-job-hunt-redesign.md
**Requirements**: FR-9 (Search Result Limit), FR-10 (Search Result Detail Preview), FR-11 (Search Save Flow), FR-16 (Resume Generation Uses Profile)
**Issues**: #233, #234, #235, #236, #237, #238, #239, #240

## Overview

Improve the job search experience with a configurable result limit, clickable detail previews, polished save-to-jobs flow with confirmation toast, and integrate user profile data into resume generation so AI produces tailored resumes instead of generic content.

## Current State

- **Search API** (`backend/app/api/search.py`): POST /api/search/ accepts query, location, provider, page — **no `limit` parameter**. Each provider returns ~10 results per page (hardcoded in provider modules).
- **Search providers** (`backend/app/services/providers/`):
  - Adzuna: `results_per_page=10` hardcoded
  - SerpAPI: `start=(page-1)*10`, implicit 10 per page
  - JSearch: `num_pages="1"` hardcoded
- **Auto search** (`POST /api/search/auto`): queries all 3 providers, deduplicates by URL, no limit on total results.
- **Save from search** (`POST /api/search/save`): already exists and works — creates a Job record. Frontend `useSaveSearchResult` mutation invalidates jobs cache. But no toast notification and no visual feedback beyond button state.
- **Search UI** (`frontend/src/components/jobs/job-search.tsx`): SearchResultCard shows title, company, location, salary, description snippet, external link, Save button. Cards are NOT clickable for a detail view.
- **Search hook** (`frontend/src/hooks/use-search.ts`): `useJobSearch()` and `useSaveSearchResult()` — pagination with "Load more" (hasMore based on `data.length === 10`).
- **Resume generation** (`backend/app/services/resume.py:generate_resume`): uses ONLY job title/company/description. Does NOT load UserProfile. Prompt says "create realistic but generic content" if experience unknown.
- **Prompt assembly** (`backend/app/services/prompt_assembly.py`): already supports `user_profile` key in context dict — just needs to be passed by resume service.
- **UserProfile model & service**: fully functional CRUD + AI import (Phase 15-16).

## Tasks

### Task 1: Backend — Add `limit` parameter to search API and providers

**Description**: Add optional `limit` parameter to SearchRequest schema, search service, and all 3 provider modules. The limit controls total results per search call. Default: 10 (current behavior). Max: 100. For auto-search, distribute limit proportionally across providers.

**Files**:
- `backend/app/schemas/search.py` (edit — add `limit` field to SearchRequest and AutoSearchRequest)
- `backend/app/services/search.py` (edit — pass limit to providers, cap auto_search total)
- `backend/app/services/providers/adzuna.py` (edit — use `limit` instead of hardcoded 10)
- `backend/app/services/providers/serpapi.py` (edit — use `limit` for num parameter)
- `backend/app/services/providers/jsearch.py` (edit — use `limit` for num_pages calculation)
- `backend/app/api/search.py` (edit — pass limit through)

**Logic**:
- SearchRequest: `limit: int = 10` (min 1, max 100)
- AutoSearchRequest: `limit: int = 30` (min 1, max 100)
- Each provider accepts `limit` param and caps its results
- For auto_search: divide limit by number of providers (e.g., 30 / 3 = 10 per provider), then deduplicate

**Acceptance Criteria**:
- [ ] SearchRequest has `limit` field with default 10, min 1, max 100
- [ ] Each provider respects the limit parameter
- [ ] Auto-search distributes limit across providers
- [ ] Backward compatible — omitting limit returns 10 results (same as before)
- [ ] No existing tests broken

**Verification**: `cd backend && python -m pytest tests/ -v`

---

### Task 2: Frontend — Add "Max results" input to search form

**Description**: Add a "Max results" number input to the search form. Pass the value to the search API. Update the hasMore logic to use the configured limit instead of hardcoded 10.

**Dependencies**: Task 1

**Files**:
- `frontend/src/types/search.ts` (edit — add `limit` to SearchRequest)
- `frontend/src/hooks/use-search.ts` (edit — pass limit, fix hasMore logic)
- `frontend/src/components/jobs/job-search.tsx` (edit — add limit input, pass to hook)

**UI**:
- Number input labeled "Max results" next to the provider selector
- Default value: 10, step 10, min 1, max 100
- Pass to search API in request body
- Update hasMore: `data.length === limit` instead of `data.length === 10`

**Acceptance Criteria**:
- [ ] "Max results" input visible in search form
- [ ] Value passed to backend via SearchRequest.limit
- [ ] hasMore logic uses configured limit, not hardcoded 10
- [ ] Default behavior unchanged when input left at 10
- [ ] Follows design-brief.md styling

**Verification**: Visual check — search with limit=5, verify only 5 results returned

---

### Task 3: Frontend — Search result detail preview dialog

**Description**: Make search result cards clickable to open a detail dialog/drawer showing full description, company, location, salary range, source URL (clickable, opens in new tab), and a prominent "Save to Jobs" button. The existing compact card remains, but clicking it opens this expanded view.

**Dependencies**: None (can start in parallel with Tasks 1-2)

**Files**:
- `frontend/src/components/jobs/search-result-detail.tsx` (new)
- `frontend/src/components/jobs/job-search.tsx` (edit — make cards clickable, manage dialog state)

**Component: SearchResultDetail**:
- Dialog/Sheet component (use shadcn Dialog or Sheet)
- Props: `result: SearchResult`, `open: boolean`, `onOpenChange`, `onSave`
- Layout:
  - Header: title (large), company name
  - Body: location, salary range (formatted), full description (scrollable), source badge
  - Footer: "Open Original" button (external link), "Save to Jobs" button (primary)
- Close on save (after success)

**Card changes**:
- Entire SearchResultCard becomes clickable (cursor-pointer, hover effect)
- Clicking opens SearchResultDetail dialog
- Existing "Save Job" button on card still works independently (no need to open detail first)
- External link icon still opens URL directly (stopPropagation)

**Acceptance Criteria**:
- [ ] Clicking a search result card opens detail dialog
- [ ] Dialog shows full description, company, location, salary, source
- [ ] "Open Original" opens source URL in new tab
- [ ] "Save to Jobs" button saves the job (calls save mutation)
- [ ] Dialog closes after successful save
- [ ] External link and save button on card still work without opening dialog
- [ ] Follows design-brief.md styling

**Verification**: Visual check — search, click result, verify dialog content, save from dialog

---

### Task 4: Frontend — Improve save flow with toast and status feedback

**Description**: When saving a search result to Jobs (from card or detail dialog), show a success toast with the job title and a link/action to view it. Add visual feedback (saved state) on the card after saving.

**Dependencies**: Task 3

**Files**:
- `frontend/src/components/jobs/job-search.tsx` (edit — add toast on save, track saved state)
- `frontend/src/components/jobs/search-result-detail.tsx` (edit — add toast on save from dialog)
- `frontend/src/hooks/use-search.ts` (edit — return saved job data from mutation for toast)

**Behavior**:
- On successful save: show toast "Saved: {title} at {company}" with "View Job" action
- "View Job" action switches to Jobs tab (or navigates to /jobs/{id})
- Card shows "Saved" badge/state after saving (disable Save button, show checkmark)
- Track saved URLs in local state to persist saved state during session
- Detail dialog: close dialog after save + show toast

**Acceptance Criteria**:
- [ ] Toast appears after successful save with job title
- [ ] Toast has "View Job" action that navigates to saved job
- [ ] Card shows saved state (button disabled, checkmark or "Saved" text)
- [ ] Saved state persists while browsing search results (same session)
- [ ] Works from both card button and detail dialog button
- [ ] Error toast if save fails

**Verification**: Visual check — save a job, verify toast, verify card state, click "View Job"

---

### Task 5: Backend — Resume generation uses user profile

**Description**: Modify the resume generation service to load UserProfile and pass it as context to the prompt assembly service. This replaces the generic content generation with personalized resume tailored to the user's actual skills, experience, and education.

**Dependencies**: None (independent of search tasks)

**Files**:
- `backend/app/services/resume.py` (edit — load profile, pass to prompt_assembly)

**Changes to `generate_resume()`**:
1. After loading Application + Job, load UserProfile for the user
2. If profile exists, build profile_text (same format as job_matching.py)
3. Call `assemble_prompt()` with operation="resume_generation" and context including `user_profile`
4. If profile does NOT exist, fall back to current behavior (no breaking change)
5. Replace the old hardcoded RESUME_SYSTEM/RESUME_USER_TEMPLATE with prompt_assembly

**Changes to `generate_ats_audit()` and `generate_gap_analysis()`**:
- Also pass user_profile to context if available (secondary improvement)

**Profile text format** (reuse from job_matching.py):
```
SUMMARY: {summary}
SKILLS: {comma-separated skill names}
EXPERIENCE:
- {title} at {company}: {description}
EDUCATION:
- {degree} from {institution}
CONTACTS: {email}, {phone}, {linkedin}, {location}
```

**Acceptance Criteria**:
- [ ] Resume generation loads UserProfile if available
- [ ] Profile data passed to prompt_assembly as `user_profile` context
- [ ] Generated resume uses real user data (skills, experience, education)
- [ ] Falls back gracefully if no profile exists (current behavior preserved)
- [ ] ATS audit and gap analysis also receive profile context
- [ ] No breaking changes to existing resume generation flow

**Verification**: Generate resume for a job with profile set up — verify resume contains user's actual skills/experience

---

### Task 6: Backend — Extract profile_text builder utility

**Description**: Both `job_matching.py` and `resume.py` (after Task 5) need to build a text representation of UserProfile. Extract this into a shared utility to avoid duplication.

**Dependencies**: Task 5

**Files**:
- `backend/app/services/profile_utils.py` (new — `build_profile_text(profile: UserProfile) -> str`)
- `backend/app/services/job_matching.py` (edit — use shared utility)
- `backend/app/services/resume.py` (edit — use shared utility)

**Function**:
```python
def build_profile_text(profile) -> str:
    """Build a text representation of UserProfile for LLM context."""
    # Extract from job_matching.py lines ~50-80
```

**Acceptance Criteria**:
- [ ] Shared utility produces identical output to current job_matching.py logic
- [ ] Both services use the shared utility
- [ ] No behavior changes
- [ ] All existing tests pass

**Verification**: `cd backend && python -m pytest tests/ -v`

---

### Task 7: Backend tests for search limit and resume profile integration

**Description**: Write tests for the new search limit parameter and for resume generation with user profile.

**Dependencies**: Tasks 1, 5, 6

**Files**:
- `backend/tests/test_search_limit.py` (new)
- `backend/tests/test_resume_profile.py` (new)

**Test cases — search limit**:
- Search with default limit returns up to 10 results
- Search with limit=5 returns up to 5 results
- Search with limit > 100 is capped to 100
- Search with limit < 1 returns validation error
- Auto-search distributes limit across providers

**Test cases — resume with profile**:
- Resume generation includes profile data in prompt when profile exists
- Resume generation falls back to old behavior when no profile
- Profile text builder produces expected format
- ATS audit includes profile context when available

**Acceptance Criteria**:
- [ ] All new tests pass
- [ ] LLM calls mocked
- [ ] All existing tests still pass

**Verification**: `cd backend && python -m pytest tests/ -v`

---

### Task 8: Frontend tests for search improvements

**Description**: Write frontend tests for the new search components and behaviors.

**Dependencies**: Tasks 2, 3, 4

**Files**:
- `frontend/__tests__/search-result-detail.test.tsx` (new)
- `frontend/__tests__/job-search-improvements.test.tsx` (new)

**Test cases**:
- SearchResultDetail renders all fields (title, company, location, salary, description)
- SearchResultDetail "Save to Jobs" button triggers save mutation
- SearchResultDetail "Open Original" button has correct href
- Search form renders "Max results" input with default value 10
- Search result card is clickable and opens detail dialog
- Saved state shows on card after saving

**Acceptance Criteria**:
- [ ] All tests pass
- [ ] API calls mocked
- [ ] Key interactions covered
- [ ] All existing frontend tests pass

**Verification**: `cd frontend && npm test`

---

## Task Dependency Graph

```
Task 1 (backend search limit)
  └── Task 2 (frontend search limit input)
        └── Task 4 (save flow toast) ← also depends on Task 3

Task 3 (search result detail dialog) — independent

Task 5 (resume uses profile) — independent
  └── Task 6 (extract profile_text utility)

Task 7 (backend tests) — depends on Tasks 1, 5, 6
Task 8 (frontend tests) — depends on Tasks 2, 3, 4
```

## Execution Order

1. Task 1 — Backend search limit parameter
2. Task 3 — Search result detail preview dialog (parallel with Task 1)
3. Task 5 — Resume generation uses user profile (parallel with Tasks 1, 3)
4. Task 2 — Frontend search limit input (after Task 1)
5. Task 6 — Extract profile_text utility (after Task 5)
6. Task 4 — Save flow with toast (after Tasks 2, 3)
7. Task 7 — Backend tests (after Tasks 1, 5, 6)
8. Task 8 — Frontend tests (after Tasks 2, 3, 4)

Parallelizable groups:
- Tasks 1 + 3 + 5 (all independent)
- Tasks 2 + 6 (after their respective dependencies)
- Tasks 7 + 8 (after all implementation)
