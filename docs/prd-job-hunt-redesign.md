# PRD: Job Hunt Module Redesign

## Metadata
| Field | Value |
|-------|-------|
| Author | Dmitrii Vasichev |
| Date | 2026-03-09 |
| Status | Approved |
| Priority | P0 |

## Problem Statement

The current Job Hunt module uses a card-based layout for the jobs list, which doesn't scale well when tracking dozens of jobs. Key information (status, match score, source) isn't visible at a glance. ATS resume generation rules are hardcoded in backend prompts with no way to customize them through the UI. There is no user profile to store skills/experience for AI-powered job matching. Search results lack detail views and a configurable result limit. Jobs cannot be linked to tasks or calendar events, making it hard to track interview prep and scheduled meetings alongside applications.

## User Scenarios

### Scenario 1: Browse and manage jobs
**As a** job seeker, **I want to** see all my tracked jobs in a sortable table with status, company, match score, and source visible, **so that** I can quickly assess my pipeline at a glance.

### Scenario 2: Switch to Kanban view
**As a** job seeker, **I want to** toggle between table and Kanban views, **so that** I can visualize my pipeline by status columns when needed.

### Scenario 3: View job detail with all context
**As a** job seeker, **I want to** click a job row to open a detail card showing description, status, source link, match score, linked tasks, linked meetings, and resume/cover letter tools, **so that** I have everything about a job in one place.

### Scenario 4: Run AI job matching
**As a** job seeker, **I want to** click a "Match" button on a job detail page that compares my profile against the job description, **so that** I see a match percentage and detailed skill breakdown (matched, missing, strengths, recommendations).

### Scenario 5: Configure my professional profile
**As a** job seeker, **I want to** maintain a structured profile (skills, experience, education, summary, contacts) in the app, **so that** AI matching and resume generation use my real data instead of defaults.

### Scenario 6: Manage AI Knowledge Base
**As a** job seeker, **I want to** view and edit the reference documents (resume writing rules, ATS optimization guide, analysis checklist, cover letter rules) that the AI uses when generating resumes and running audits, **so that** I have full control over the quality and style of AI output.

### Scenario 7: Search and save jobs
**As a** job seeker, **I want to** search external job boards with a configurable result limit (default 100), click on a result to preview its details, and save it to my Jobs list with status "Found", **so that** I can efficiently discover and track new opportunities.

### Scenario 8: Link tasks and meetings to jobs
**As a** job seeker, **I want to** link existing tasks (e.g., "Prepare portfolio") and calendar events (e.g., "Phone screen with Acme") to a job, **so that** I can see all related activities on the job detail page.

## Functional Requirements

### P0 (Must Have)

- [ ] FR-1: **Jobs Table View** — Replace card grid with a data table (columns: title, company, status badge, match score, source, found date). Sortable by each column. Rows clickable to open detail page.
- [ ] FR-2: **Table ↔ Kanban Toggle** — Add a view switcher (table/kanban) on the Jobs tab. Persist the user's last selected view in localStorage. Kanban shows match score on cards.
- [ ] FR-3: **Job Detail Page Redesign** — Restructure the job detail page (`/jobs/[id]`) to prominently show: job description, status with change control, clickable source URL (opens in new tab), match score result, linked tasks section, linked calendar events section, and existing resume/cover letter tools.
- [ ] FR-4: **User Profile Model & API** — Create a `UserProfile` model with structured fields: summary (text), skills (JSON array of {name, level?, years?}), experience (JSON array of {title, company, location, start_date, end_date, description}), education (JSON array of {degree, institution, year}), contacts (JSON: {email, phone, linkedin, location}). CRUD API endpoints under `/api/profile/`.
- [ ] FR-5: **User Profile UI** — Add a Profile page (accessible from sidebar "Profile" link) with editable sections: Contact Info, Summary, Skills (tag-style input with optional level), Experience (add/edit/delete entries), Education (add/edit/delete entries). Pre-populate from uploaded text or manual entry.
- [ ] FR-6: **Profile Import from Text** — On the Profile page, add an "Import from text" button that accepts a pasted text blob (like LinkedIn export) and uses AI to parse it into the structured profile format.
- [ ] FR-7: **AI Job Matching** — Add a "Run Match" button on job detail page. Backend endpoint `/api/jobs/{id}/match` that: reads user profile, reads job description, calls LLM to produce match result (score 0-100, matched_skills[], missing_skills[], strengths[], recommendations[]). Result saved to `Job.match_score` and a new `Job.match_result` JSON field. Match score visible in table and kanban views.
- [ ] FR-8: **AI Knowledge Base** — Two-layer AI prompt architecture:
  - **Layer 1 — Instructions** (short): 4 task-specific instructions stored in `UserSettings` (resume generation, ATS audit, gap analysis, cover letter). Each is a short directive telling the AI WHAT to do. Editable in Settings → "AI Instructions" section.
  - **Layer 2 — Reference Documents** (full MD): Stored in a new `AiKnowledgeBase` table. Each document is a comprehensive guide telling the AI HOW to do it. Default documents seeded from the OpenClaw resume-optimizer skill:
    - "Resume Writing Rules" (~3 KB) — action verbs, STAR method, bullet structure, section guidance, format standards. Used by: Resume Generation.
    - "ATS Optimization Guide" (~5 KB) — ATS-friendly formatting, keyword strategies, common pitfalls, testing checklist. Used by: Resume Generation, ATS Audit.
    - "Analysis Checklist & Scoring" (~4 KB) — 100-point rubric (Content 40%, Formatting 20%, ATS 20%, Relevance 20%), section-by-section criteria, recommendation templates. Used by: ATS Audit, Gap Analysis.
    - "Cover Letter Rules" (~2 KB) — structure, tone, personalization, length guidelines. Used by: Cover Letter Generation.
  - **UI**: Settings → "AI Knowledge Base" tab with a list of documents. Each document opens in a full MD editor. "Reset to default" button per document. Users can also add custom documents.
  - **Prompt Assembly**: For each AI call, the service assembles: `instruction + relevant reference docs + user profile data + job/resume data` → LLM.
  - **Mapping**: Each AI operation (resume gen, ATS audit, gap analysis, cover letter) has a configurable list of which reference documents to include. Default mapping provided, user can adjust.
- [ ] FR-9: **Search Result Limit** — Add a "Max results" input to the Search tab (default: 100). Pass limit to backend. Backend caps results from each provider proportionally.
- [ ] FR-10: **Search Result Detail Preview** — Make search result cards clickable to open a detail dialog/drawer showing full description, company, location, salary, source URL (clickable), and a "Save to Jobs" button.
- [ ] FR-11: **Search Save Flow** — When saving a search result, create a Job with status "Found" (via existing `/api/search/save`). Show confirmation toast and navigate or highlight the saved job in the Jobs tab.
- [ ] FR-12: **Job ↔ Task Linking** — Create `JobTaskLink` many-to-many table. API endpoints: `POST/DELETE /api/jobs/{id}/link-task/{task_id}`, `GET /api/jobs/{id}/linked-tasks`. Show linked tasks on job detail page with ability to link/unlink.
- [ ] FR-13: **Job ↔ Calendar Event Linking** — Create `JobEventLink` many-to-many table. API endpoints: `POST/DELETE /api/jobs/{id}/link-event/{event_id}`, `GET /api/jobs/{id}/linked-events`. Show linked events on job detail page with ability to link/unlink.

### P1 (Should Have)

- [ ] FR-14: **Batch Match** — Button on Jobs table to run matching for all jobs that don't have a match score yet.
- [ ] FR-15: **Profile Text File Upload** — Accept .txt file upload on Profile page (in addition to paste).
- [ ] FR-16: **Default Profile for Resume Generation** — Resume generation service uses user profile data (summary, skills, experience, education) as context alongside job description, instead of generating from scratch.

### P2 (Nice to Have)

- [ ] FR-17: **Match Score Filters** — Filter jobs table by match score range (e.g., >80%).
- [ ] FR-18: **KB Document Templates** — Pre-built knowledge base document sets (e.g., "Tech/Engineering", "Management", "Data/Analytics") that users can import alongside defaults.

## Non-Functional Requirements

- **Performance**: Table view must handle 500+ jobs without lag (virtual scrolling if needed).
- **Data Migration**: Existing jobs, applications, and resumes must not be affected. New fields (match_result, profile) are nullable.
- **Security**: User profile data is user-scoped (same access control as existing models). ATS prompts are per-user.
- **UI Consistency**: Follow existing design-brief.md — dark theme, shadcn/ui components, same color palette.

## Technical Design

### Stack (no changes)
- Frontend: Next.js 14, TypeScript, Tailwind CSS, shadcn/ui, TanStack Table
- Backend: FastAPI, SQLAlchemy, PostgreSQL
- AI: Pluggable LLM (OpenAI/Claude/Gemini)

### New Database Entities

#### UserProfile
```
user_profiles:
  id: int PK
  user_id: int FK→users (unique)
  summary: text nullable
  skills: json []  -- [{name, level?, years?}]
  experience: json []  -- [{title, company, location, start_date, end_date, description}]
  education: json []  -- [{degree, institution, year}]
  contacts: json {}  -- {email, phone, linkedin, location}
  raw_import: text nullable  -- original imported text for reference
  created_at: timestamp
  updated_at: timestamp
```

#### Job extensions
```
jobs (alter):
  match_result: json nullable  -- {score, matched_skills[], missing_skills[], strengths[], recommendations[]}
```

#### UserSettings extensions
```
user_settings (alter):
  instruction_resume: text nullable       -- short instruction for resume generation
  instruction_ats_audit: text nullable    -- short instruction for ATS audit
  instruction_gap_analysis: text nullable -- short instruction for gap analysis
  instruction_cover_letter: text nullable -- short instruction for cover letter
```

#### AiKnowledgeBase
```
ai_knowledge_base:
  id: int PK
  user_id: int FK→users
  slug: varchar(100)  -- unique per user, e.g. "resume-writing-rules"
  title: varchar(255) -- display name, e.g. "Resume Writing Rules"
  content: text        -- full MD document
  is_default: bool     -- true for seeded docs, false for user-created
  used_by: json []     -- ["resume_generation", "ats_audit"] — which operations use this doc
  created_at: timestamp
  updated_at: timestamp
  unique(user_id, slug)
```

Default documents seeded on first user creation:
| slug | title | used_by | source |
|------|-------|---------|--------|
| resume-writing-rules | Resume Writing Rules | ["resume_generation"] | OpenClaw best-practices.md |
| ats-optimization | ATS Optimization Guide | ["resume_generation", "ats_audit"] | OpenClaw ats-optimization.md |
| analysis-checklist | Analysis Checklist & Scoring | ["ats_audit", "gap_analysis"] | OpenClaw analysis-checklist.md |
| cover-letter-rules | Cover Letter Rules | ["cover_letter"] | OpenClaw cover-letter best practices |

#### JobTaskLink
```
job_task_links:
  id: int PK
  job_id: int FK→jobs (cascade)
  task_id: int FK→tasks (cascade)
  unique(job_id, task_id)
```

#### JobEventLink
```
job_event_links:
  id: int PK
  job_id: int FK→jobs (cascade)
  event_id: int FK→calendar_events (cascade)
  unique(job_id, event_id)
```

### Key API Endpoints (new/modified)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/profile/` | Get user profile |
| PUT | `/api/profile/` | Create/update user profile |
| POST | `/api/profile/import` | AI-parse text into structured profile |
| POST | `/api/jobs/{id}/match` | Run AI matching for a job |
| POST/DELETE | `/api/jobs/{id}/link-task/{task_id}` | Link/unlink task |
| POST/DELETE | `/api/jobs/{id}/link-event/{event_id}` | Link/unlink event |
| GET | `/api/jobs/{id}/linked-tasks` | Get linked tasks |
| GET | `/api/jobs/{id}/linked-events` | Get linked events |
| GET | `/api/knowledge-base/` | List all user's KB documents |
| GET | `/api/knowledge-base/{slug}` | Get single KB document |
| PUT | `/api/knowledge-base/{slug}` | Update KB document content |
| POST | `/api/knowledge-base/` | Create custom KB document |
| DELETE | `/api/knowledge-base/{slug}` | Delete custom KB document (not default ones) |
| POST | `/api/knowledge-base/{slug}/reset` | Reset default doc to original content |

### Frontend Component Changes

| Component | Change |
|-----------|--------|
| `jobs/page.tsx` | Add table/kanban view toggle, replace card grid with TanStack Table |
| `jobs/job-card.tsx` | Deprecate (replaced by table rows) |
| `jobs/[id]/page.tsx` | Add match section, linked tasks/events sections, source URL button |
| `jobs/job-search.tsx` | Add limit input, clickable result detail dialog |
| `settings/page.tsx` | Add "AI Instructions" tab + "AI Knowledge Base" tab |
| NEW `profile/page.tsx` | User profile page with sections |
| NEW `jobs/jobs-table.tsx` | Table component with TanStack Table |
| NEW `jobs/job-match-section.tsx` | Match result display + run button |
| NEW `jobs/linked-items-section.tsx` | Linked tasks & events display with link/unlink |
| NEW `jobs/search-result-detail.tsx` | Search result detail dialog |

### AI Prompt Assembly Flow

```
┌─────────────────────────────────────────────────────┐
│  Example: Resume Generation                         │
│                                                     │
│  1. Instruction (from UserSettings)                 │
│     "Generate a tailored, ATS-optimized resume      │
│      following the rules in REFERENCE below."        │
│                                                     │
│  2. Reference Documents (from AiKnowledgeBase)      │
│     ┌─ resume-writing-rules (used_by includes       │
│     │  "resume_generation")                         │
│     └─ ats-optimization (used_by includes           │
│        "resume_generation")                         │
│                                                     │
│  3. User Profile (from UserProfile)                 │
│     Contact, summary, skills, experience, education │
│                                                     │
│  4. Job Data                                        │
│     Title, company, description                     │
│                                                     │
│  Assembly:                                          │
│  system_prompt = instruction                        │
│  user_prompt   = reference_docs                     │
│                 + user_profile                       │
│                 + job_data                           │
│                 + output_format_spec                 │
│                                                     │
│  → LLM → structured result                          │
└─────────────────────────────────────────────────────┘
```

## Out of Scope
- LinkedIn API integration (no public API available for profile import)
- Automated job application submission
- Interview scheduling automation
- Resume PDF template customization (using existing ReportLab format)
- External ATS system integration

## Acceptance Criteria
- [ ] AC-1: Jobs page shows a sortable data table with columns: title, company, status, match score, source, date
- [ ] AC-2: User can toggle between table and kanban views; preference is persisted
- [ ] AC-3: Clicking a job row opens the detail page with all sections (description, status, source link, match, linked items, resume tools)
- [ ] AC-4: User can create and edit a structured profile (skills, experience, education, contacts, summary)
- [ ] AC-5: User can import profile from pasted text via AI parsing
- [ ] AC-6: "Run Match" button produces and displays match score + detailed breakdown, saved to job record
- [ ] AC-7: Match score is visible in both table and kanban views
- [ ] AC-8: AI Knowledge Base contains 4 default reference documents; user can view, edit, reset to default, and add custom documents; AI operations assemble prompts from instruction + relevant KB docs + user data
- [ ] AC-9: Search respects configurable result limit (default 100)
- [ ] AC-10: Search results are clickable with detail preview and "Save to Jobs" action
- [ ] AC-11: User can link/unlink tasks and calendar events to/from a job
- [ ] AC-12: Linked tasks and events are visible on the job detail page
- [ ] AC-13: All existing jobs, applications, and resumes remain intact after migration

## Open Questions
- None at this time.
