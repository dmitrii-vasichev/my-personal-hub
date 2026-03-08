# PRD: Personal Hub

## Metadata
| Field | Value |
|-------|-------|
| Author | Dmitry Vasichev |
| Date | 2026-03-08 |
| Status | Approved |
| Priority | P0 |

## Problem Statement

The user currently has separate standalone portals for task management and job hunting, each with its own deployment, auth system, and UI. This fragmentation makes daily workflow inefficient — switching between multiple apps, maintaining multiple deployments, and duplicating shared infrastructure (auth, settings, notifications).

**Personal Hub** consolidates all personal productivity tools into a single portal with unified authentication, shared navigation, and a modular architecture that allows adding new modules over time (health tracking, Telegram channel parsing, etc.).

## User Scenarios

### Scenario 1: Daily Task Management
**As a** user, **I want to** manage my tasks on a Kanban board, **so that** I can track progress visually and stay organized.

### Scenario 2: Job Application Tracking
**As a** user, **I want to** track job applications through a pipeline (found → applied → interview → offer), **so that** I can manage my job search systematically.

### Scenario 3: Calendar & Meeting Management
**As a** user, **I want to** view and create calendar events synced with Google Calendar, **so that** I have a single place for all my schedules.

### Scenario 4: Family Access
**As an** admin, **I want to** create accounts for family members with limited access, **so that** they can use the portal too.

### Scenario 5: Job Search
**As a** user, **I want to** search for jobs across external providers and save interesting ones, **so that** I can build a pipeline of opportunities.

### Scenario 6: Resume & Cover Letter Generation
**As a** user, **I want to** generate tailored resumes and cover letters using AI, **so that** I can apply to jobs faster with optimized materials.

---

## Functional Requirements

### P0 (Must Have)

#### Module: Authentication & User Management
- [ ] FR-1: Email + password authentication with JWT tokens
- [ ] FR-2: Admin can create new users (generates temporary password)
- [ ] FR-3: First login forces password change
- [ ] FR-4: Two roles: `admin` and `user`
- [ ] FR-5: Admin sees all data; user sees only their own data
- [ ] FR-6: Login/logout with session persistence (7-day JWT)

#### Module: Task Manager
- [ ] FR-7: Create tasks with title, description, priority (urgent/high/medium/low), deadline
- [ ] FR-8: Kanban board with columns: New, In Progress, Review, Done, Cancelled
- [ ] FR-9: Drag-and-drop between columns (desktop); tab navigation (mobile)
- [ ] FR-10: Task detail view with full info and timeline
- [ ] FR-11: Checklist (subtasks) within a task — add, edit, toggle completion
- [ ] FR-12: Task updates/comments timeline — progress, status_change, comment, blocker
- [ ] FR-13: Task filters: status, priority, assignee, search text, deadline
- [ ] FR-14: Task source tracking: web (manual creation)
- [ ] FR-15: Assign tasks to other users (admin only)

#### Module: Job Hunt
- [ ] FR-16: Job CRUD — title, company, location, URL, source, description, salary range, tags, match score
- [ ] FR-17: Application tracking with statuses: found → saved → resume_generated → applied → screening → technical_interview → final_interview → offer → accepted/rejected/ghosted/withdrawn
- [ ] FR-18: Kanban board for applications (drag-and-drop status changes)
- [ ] FR-19: Application detail: notes, recruiter info, next action, dates, status history
- [ ] FR-20: Job search from external providers (Adzuna, SerpAPI, JSearch)
- [ ] FR-21: Save search results as tracked jobs
- [ ] FR-22: Auto-search based on saved target roles and location
- [ ] FR-23: AI-powered resume generation tailored to job description (multi-provider: OpenAI/Anthropic/Gemini)
- [ ] FR-24: ATS score audit for generated resumes
- [ ] FR-25: Gap analysis (matching/missing keywords, strengths, recommendations)
- [ ] FR-26: Cover letter generation with AI
- [ ] FR-27: Resume PDF preview and download
- [ ] FR-28: Job Hunt analytics: funnel, timeline, skills demand, sources, response time, ATS scores
- [ ] FR-29: User settings: target roles, default location, excluded companies, LLM provider, API keys (encrypted)
- [ ] FR-30: Fetch full job description from URL (server-side scraping with SSRF protection)

#### Module: Calendar & Meetings
- [ ] FR-31: Google Calendar OAuth2 integration (bidirectional sync)
- [ ] FR-32: View calendar events in weekly/monthly view
- [ ] FR-33: Create events on portal → sync to Google Calendar
- [ ] FR-34: Google Calendar events appear on portal automatically
- [ ] FR-35: Add comments/notes to meetings (stored locally, not synced to Google)
- [ ] FR-36: Meeting detail page with notes and linked tasks

#### Module: Navigation & Layout
- [ ] FR-37: Sidebar navigation with modules: Dashboard, Tasks, Job Hunt, Calendar
- [ ] FR-38: Responsive layout (desktop + mobile)
- [ ] FR-39: User profile in header with logout

### P1 (Should Have)

- [ ] FR-40: Dashboard home page with summary cards from all modules
- [ ] FR-41: Task reminders (set reminder date/time, in-app notification)
- [ ] FR-42: Link tasks to calendar events
- [ ] FR-43: Dark mode / theme toggle
- [ ] FR-44: Task Manager analytics (tasks by status, completion rate, overdue count)

### P2 (Nice to Have)

- [ ] FR-45: Telegram channel parsing for job vacancies (future — requires Telethon/Python microservice)
- [ ] FR-46: Health / diet tracking module
- [ ] FR-47: Email notifications for reminders and task assignments
- [ ] FR-48: Export data (tasks, applications) to CSV

---

## Non-Functional Requirements

- **Performance:** Page load < 2s, API response < 500ms for list queries
- **Security:** Passwords hashed with bcrypt, JWT with HS256, API keys encrypted at rest, SSRF protection on URL fetching
- **Scalability:** Modular architecture — each module is an independent set of routes/services/models, new modules can be added without touching existing code
- **Availability:** Deployed to cloud (Vercel + Railway), accessible 24/7
- **Browser support:** Modern browsers (Chrome, Firefox, Safari, Edge — latest 2 versions)
- **Mobile:** Responsive design, usable on phone (not native app)

---

## Technical Design

### Architecture
```
┌─────────────────────────────┐
│  Frontend (Next.js 14)      │  → Vercel
│  TypeScript + Tailwind      │
│  shadcn/ui + @dnd-kit       │
│  TanStack Query (React Query)│
└──────────┬──────────────────┘
           │ REST API (HTTPS)
┌──────────▼──────────────────┐
│  Backend (FastAPI / Python)  │  → Railway
│  SQLAlchemy 2.0 (async)     │
│  Alembic migrations         │
│  Pydantic v2 schemas        │
└──────────┬──────────────────┘
           │
┌──────────▼──────────────────┐
│  PostgreSQL                  │  → Supabase or Railway
└─────────────────────────────┘

External integrations:
  - Google Calendar API (OAuth2)
  - Job search APIs (Adzuna, SerpAPI, JSearch)
  - LLM providers (OpenAI, Anthropic, Gemini)
```

### Stack
| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14+, TypeScript, Tailwind CSS, shadcn/ui, @dnd-kit, TanStack Query, recharts |
| Backend | Python 3.12, FastAPI, SQLAlchemy 2.0 (async), Alembic, Pydantic v2 |
| Database | PostgreSQL (async via asyncpg) |
| Auth | bcrypt + JWT (PyJWT), 7-day token expiry |
| AI | OpenAI / Anthropic / Google Gemini (multi-provider, user-selectable) |
| Deploy | Vercel (frontend), Railway (backend + DB) |
| External APIs | Google Calendar API, Adzuna, SerpAPI, JSearch |

### Database Schema (Core Tables)

**Auth & Users:**
- `users` — id, email, password_hash, role (admin/user), display_name, must_change_password, created_at

**Task Manager:**
- `tasks` — id, user_id, title, description, status, priority, checklist (JSONB), deadline, reminder_at, assignee_id, created_by_id, source, short_id (auto-increment), created_at, updated_at, completed_at
- `task_updates` — id, task_id, author_id, type (progress/status_change/comment/blocker), content, old_status, new_status, progress_percent, created_at

**Job Hunt:**
- `jobs` — id, user_id, title, company, location, url, source, description, salary_min, salary_max, salary_currency, match_score, tags (JSON), found_at, created_at, updated_at
- `applications` — id, user_id, job_id, status, notes, recruiter_name, recruiter_contact, applied_date, next_action, next_action_date, rejection_reason, created_at, updated_at
- `status_history` — id, application_id, old_status, new_status, changed_at, comment
- `resumes` — id, application_id, version, resume_json (JSON), pdf_url, ats_score, ats_audit_result (JSON), gap_analysis (JSON), created_at
- `cover_letters` — id, application_id, content, version, created_at
- `user_settings` — id, user_id, default_location, target_roles (JSON), min_match_score, excluded_companies (JSON), stale_threshold_days, llm_provider, api_key_openai (encrypted), api_key_anthropic (encrypted), api_key_gemini (encrypted), updated_at

**Calendar:**
- `calendar_events` — id, user_id, google_event_id, title, description, start_time, end_time, location, all_day, synced_at, created_at, updated_at
- `event_notes` — id, event_id, user_id, content, created_at, updated_at

### API Structure

```
/api/auth/          — login, register (admin), me, change-password
/api/users/         — CRUD (admin only)
/api/tasks/         — CRUD, filters, kanban
/api/tasks/{id}/updates/ — task timeline
/api/jobs/          — CRUD, list with filters
/api/applications/  — CRUD, status changes
/api/kanban/        — job hunt kanban board
/api/search/        — external job search, save, fetch-description
/api/resumes/       — generate, ATS audit, gap analysis
/api/cover-letters/ — generate
/api/analytics/     — summary, funnel, timeline, skills, sources
/api/calendar/      — events CRUD, Google sync
/api/settings/      — user settings, LLM provider, API keys
```

---

## Implementation Phases

### Phase 1: Foundation (Auth + Layout + DB)
- Project scaffolding: Next.js 14, FastAPI, PostgreSQL, Alembic migrations
- FR-1–FR-6: Authentication & user management (JWT, roles, password change)
- FR-37–FR-39: Sidebar navigation, responsive layout, user profile
- FR-43: Theme toggle (dark/light per design brief)

### Phase 2: Task Manager
- FR-7–FR-15: Full task management module (CRUD, Kanban, drag-and-drop, detail view, checklists, timeline, filters, assignment)

### Phase 3: Job Hunt — Core
- FR-16–FR-19: Job CRUD, application tracking pipeline, applications Kanban, application detail

### Phase 4: Job Hunt — Search & AI
- FR-20–FR-22: External job search (Adzuna, SerpAPI, JSearch), save results, auto-search
- FR-23–FR-27: AI resume/cover letter generation, ATS audit, gap analysis, PDF
- FR-28: Job Hunt analytics
- FR-29: User settings (target roles, LLM provider, API keys)
- FR-30: Fetch job description from URL

### Phase 5: Calendar & Meetings
- FR-31–FR-36: Google Calendar OAuth2, weekly/monthly view, bidirectional sync, meeting notes

### Phase 6: Dashboard & Polish
- FR-40: Dashboard home page with summary cards
- FR-41: Task reminders
- FR-42: Link tasks to calendar events
- FR-44: Task Manager analytics
- Production deployment (Vercel + Railway)

---

## Out of Scope

- Telegram bot integration (no aiogram, no Telegram login)
- Telegram channel parsing for vacancies (future P2)
- Health / diet tracking module (future P2)
- Zoom integration (replaced by Google Calendar)
- Meeting scheduling with recurrence rules (using Google Calendar for this)
- AI meeting summary parsing (not needed without Zoom)
- Department/team hierarchy (not needed — personal use + family)
- Broadcast/notification system via Telegram
- Native mobile app
- Multi-language UI (Russian only initially)

---

## Acceptance Criteria

- [ ] AC-1: User can log in with email/password and access the portal
- [ ] AC-2: Admin can create a new user; new user must change password on first login
- [ ] AC-3: Tasks can be created, edited, moved on Kanban board (drag-and-drop works)
- [ ] AC-4: Task detail shows checklist, timeline, and all metadata
- [ ] AC-5: Jobs can be searched, saved, and tracked through the application pipeline
- [ ] AC-6: Resume can be generated with AI, ATS-scored, and downloaded as PDF
- [ ] AC-7: Google Calendar events are synced bidirectionally
- [ ] AC-8: Meeting notes/comments can be added to calendar events
- [ ] AC-9: All modules are accessible from sidebar navigation
- [ ] AC-10: Portal is responsive and works on mobile
- [ ] AC-11: Portal is deployed and accessible via public URL

---

## Open Questions

1. **Google Calendar:** Should we use a service account (server-to-server) or OAuth2 per-user flow? Per-user is more flexible but requires each user to authorize. Recommendation: OAuth2 per-user.
2. **Database hosting:** Supabase (free tier, managed) or Railway PostgreSQL (co-located with backend)? Recommendation: Railway PostgreSQL for simplicity.
3. **Resume PDF:** Use the same `@react-pdf/renderer` approach from Job Hunt Portal, or server-side PDF generation?
4. **Future Telethon:** When Telegram parsing is added, should it be a separate microservice or integrated into the FastAPI backend? Recommendation: separate microservice communicating via shared DB or message queue.
