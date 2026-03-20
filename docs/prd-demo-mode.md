# PRD: Demo Mode for Portfolio Showcase

## Problem

The Personal Hub is a private productivity system with authentication. To include it in a portfolio and demonstrate it to potential employers or recruiters, the owner needs a way to provide access without exposing personal data. Currently there is no mechanism for this — the only options are sharing real credentials (security risk) or screen recordings (no interactivity).

## Solution

A **Demo Mode** system consisting of:
1. A new `demo` user role with restricted access to sensitive features
2. A seed script that populates realistic sample data for the demo user
3. A reset mechanism (admin button) that restores demo data to its default state
4. Visual indicators ("Demo mode" badges) on restricted features

## User Stories

### Demo Visitor (recruiter/employer)
- **US-1:** I can log in with provided demo credentials and explore the full UI
- **US-2:** I can create, edit, and delete tasks, jobs, notes, and events to test CRUD functionality
- **US-3:** I see realistic pre-populated data that demonstrates how the app works in practice
- **US-4:** I see clear "Demo mode" indicators on features that are disabled, so I understand they exist but are restricted
- **US-5:** I cannot access admin features (user management, API key configuration, Telegram credentials)

### Owner (admin)
- **US-6:** I can reset the demo user's data to defaults with one click from Settings
- **US-7:** I can be confident that the demo user cannot access my personal data, integrations, or API keys
- **US-8:** Demo user activity does not affect my data, billing (API credits), or connected services

## Feature Scope

### New Role: `demo`

Add `demo` to the `UserRole` enum alongside `admin` and `member`. The demo role inherits member-level data isolation (sees only its own data) with additional restrictions.

### Access Matrix

| Feature | Admin | Member | Demo |
|---------|-------|--------|------|
| **Dashboard** — view summary | yes | yes | yes |
| **Tasks** — full CRUD | yes | yes | yes |
| **Tasks** — analytics | yes | yes | yes |
| **Jobs** — full CRUD | yes | yes | yes |
| **Jobs** — external search (Adzuna, etc.) | yes | yes | no (badge) |
| **Jobs** — AI match score | yes | yes | no (badge) |
| **Resumes** — generate (AI) | yes | yes | no (badge) |
| **Resumes** — ATS audit (AI) | yes | yes | no (badge) |
| **Resumes** — gap analysis (AI) | yes | yes | no (badge) |
| **Cover Letters** — generate (AI) | yes | yes | no (badge) |
| **Calendar** — local events CRUD | yes | yes | yes |
| **Calendar** — Google sync | yes | yes | no (badge) |
| **Notes** — view pre-seeded notes | yes | yes | yes (read-only, no Google Drive) |
| **Notes** — create/edit | yes | yes | no (badge) |
| **Pulse** — view pre-seeded digests | yes | yes | yes (read-only) |
| **Pulse** — sources management | yes | yes | no (badge) |
| **Pulse** — trigger polling | yes | yes | no (badge) |
| **Pulse** — generate digest (AI) | yes | yes | no (badge) |
| **Pulse** — inbox actions (to_task, to_note) | yes | yes | yes (on seeded items) |
| **Profile** — view/edit | yes | yes | yes |
| **Profile** — import from text (AI) | yes | yes | no (badge) |
| **Knowledge Base** — view/edit | yes | yes | yes |
| **Tags** — full CRUD | yes | yes | yes |
| **Settings** — view own (no keys) | yes | yes | yes (limited view) |
| **Settings** — API keys | yes | yes | no (hidden) |
| **Settings** — Google OAuth | yes | yes | no (hidden) |
| **Settings** — Telegram credentials | yes | no | no (hidden) |
| **Settings** — User management | yes | no | no (hidden) |
| **Settings** — Reset demo data button | yes | no | no |

### Restricted Feature UI Pattern

For every feature blocked for demo users, the UI shows:

```
┌─────────────────────────────────────────┐
│  🔒 Demo Mode                           │
│  This feature is available in the full  │
│  version. It uses [AI/Google/Telegram]  │
│  integration to [brief description].    │
└─────────────────────────────────────────┘
```

This replaces the action button/area (e.g., "Generate Resume" button becomes the badge). The rest of the page remains visible — the user can still see the job details, just not trigger AI generation.

### Backend Enforcement

- New dependency: `restrict_demo(current_user)` — raises 403 with message `"This feature is not available in demo mode"` if `current_user.role == "demo"`
- Applied to all restricted endpoints (AI generation, external search, Google sync, Telegram setup, polling)
- Demo user gets own isolated data (same as member) — no cross-user data leakage
- Demo user CANNOT change their own password or email

### Seed Data Script: `seed_demo.py`

Creates a demo user and populates realistic data:

**Demo User:**
- Email: `demo@personalhub.app`
- Password: `demo2026` (configurable via `DEMO_PASSWORD` env var)
- Role: `demo`
- Display name: `Alex Demo`
- `must_change_password`: false

**Profile:**
- Summary: Mid-level Full-Stack Developer, 4 years experience
- Skills: TypeScript, React, Next.js, Python, FastAPI, PostgreSQL, Docker, AWS
- Experience: 2 positions (current: Frontend Dev at TechFlow, previous: Junior Dev at DataSpark)
- Education: BS Computer Science
- Contacts: demo email, GitHub, LinkedIn (placeholder URLs)

**Tags (8 tags):**
- Work, Personal, Interview Prep, Portfolio, Learning, Urgent, Follow-up, Networking

**Tasks (12 tasks across statuses):**
- Backlog: "Research system design patterns", "Read Clean Code book"
- New: "Update LinkedIn profile", "Prepare behavioral interview answers"
- In Progress: "Build portfolio website", "Practice LeetCode daily"
- Review: "Review cover letter template"
- Done: "Complete React course", "Set up GitHub profile", "Write technical blog post", "Attend networking meetup"
- Cancelled: "Apply to Company X" (reason: position closed)

Each task has realistic descriptions, priorities, deadlines, tags, and some have checklists and updates/comments.

**Jobs (8 jobs across statuses):**
- Found: "Senior Frontend Developer" at NovaTech (remote)
- Saved: "Full-Stack Engineer" at CloudBase ($120-150k)
- Applied: "React Developer" at PixelCraft (with applied_date, recruiter info)
- Screening: "Software Engineer" at DataFlow (with next_action)
- Technical Interview: "Frontend Lead" at Quantum Labs (with event links)
- Offer: "Senior Developer" at BrightPath ($140k, decision pending)
- Rejected: "Staff Engineer" at MegaCorp (reason: overqualified concern)
- Withdrawn: "Junior Dev" at StartupXYZ (reason: misaligned with career goals)

Each job has realistic descriptions, salary ranges, notes, tags, and status history entries.

**Calendar Events (6 events):**
- Upcoming: "Technical Interview — Quantum Labs" (in 3 days), "Coffee chat with recruiter" (in 5 days)
- Past: "Phone screen — DataFlow" (2 days ago), "Networking event" (1 week ago)
- Recurring weekly: "DSA Practice session"
- All-day: "Portfolio deadline" (in 1 week)

Events have notes and some are linked to jobs.

**Knowledge Base (3 documents):**
- "elevator-pitch" — prepared elevator pitch
- "star-stories" — 3 STAR method stories for behavioral interviews
- "target-companies" — list of target companies with notes

**Notes (4 pre-seeded, stored as local records without Google Drive):**
- "Interview Preparation Checklist" — markdown checklist
- "Technical Topics to Review" — categorized study list
- "Meeting Notes — DataFlow Phone Screen" — detailed meeting notes
- "Career Goals 2026" — reflection and planning

For demo user, notes are stored as local database records (not Google Drive synced). The Notes UI renders them from a `content` field on the Note model (new nullable field, only used for demo/local notes).

**Pulse Data (pre-seeded, no real Telegram):**
- 3 sources (simulated): "Frontend Weekly", "Remote Jobs Board", "Tech Learning Hub"
- 2 digests with structured items:
  - "Learning" digest: 5 items (React Server Components article, TypeScript 6.0 features, etc.)
  - "Jobs" digest: 4 items (remote positions matching profile)
- 5 inbox items in "new" status for the visitor to practice actions

### Reset Mechanism

**Admin UI:** A "Reset Demo Data" button in Settings → User Management section (visible only to admin when demo user exists).

**Backend endpoint:** `POST /api/users/demo/reset` (admin-only)

**Behavior:**
1. Delete ALL data owned by the demo user (tasks, jobs, events, notes, tags, profile, KB, pulse data)
2. Re-run seed_demo logic to recreate default data
3. Reset demo user password to default
4. Return success with count of recreated items

**Idempotent:** Safe to run multiple times. First deletes, then recreates.

### Migration

- Add `demo` value to `UserRole` PostgreSQL enum
- Add nullable `content` field to `Note` model (for local/demo notes without Google Drive)

## Non-Goals

- Multi-tenant demo (only one demo user at a time)
- Time-limited demo sessions or auto-expiry
- Demo data customization UI (seed script is the source of truth)
- Watermarks or branding on demo pages
- Rate limiting for demo user (not needed for portfolio showcase)

## Technical Notes

- Demo user data is fully isolated — same `user_id` filtering as member
- No AI API calls for demo user — all AI features return 403
- No external service calls (Google, Telegram, job boards) for demo user
- Seed script is idempotent and can be called from both CLI and API
- Frontend checks `user.role === "demo"` to show/hide UI elements
- Auth provider exposes `isDemo` boolean for easy checks

## Phases

### Phase 42: Demo Mode — Backend (Role, Restrictions, Seed)
- Add `demo` to UserRole enum (Alembic migration)
- Add `content` field to Note model (migration)
- Create `restrict_demo` dependency
- Apply restrictions to all AI/integration endpoints
- Block password/email change for demo user
- Create `seed_demo.py` script with all seed data
- Create reset endpoint `POST /api/users/demo/reset`
- Tests for demo restrictions and seed/reset

### Phase 43: Demo Mode — Frontend (UI Badges, Reset Button)
- Add `isDemo` to auth context
- Create `DemoModeBadge` component
- Apply badges to all restricted features (AI generation, Google sync, Telegram, external search)
- Hide Settings sections (API keys, Google OAuth, Telegram credentials, User management) for demo
- Show limited Settings view for demo user
- Add "Reset Demo Data" button in admin Settings
- Local notes rendering for demo user (from `content` field)
- Frontend tests for demo UI states
