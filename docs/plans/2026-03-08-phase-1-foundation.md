# Phase 1: Foundation (Auth + Layout + DB)

## Overview
Set up the full project scaffolding — frontend (Next.js 14), backend (FastAPI), database (PostgreSQL), authentication system, sidebar navigation, responsive layout, and theme toggle.

## Tasks

### Task 1: Backend scaffolding (FastAPI + PostgreSQL + Alembic)
**Description:** Initialize FastAPI project with async SQLAlchemy 2.0, Alembic migrations, and PostgreSQL connection. Set up project structure with modular architecture.

**Files:**
- `backend/` — root backend directory
- `backend/app/main.py` — FastAPI app entry point
- `backend/app/core/config.py` — settings (env vars, DB URL)
- `backend/app/core/database.py` — async engine, session factory
- `backend/app/models/` — SQLAlchemy models directory
- `backend/alembic/` — migrations
- `backend/requirements.txt`
- `backend/Dockerfile`

**Acceptance Criteria:**
- [ ] FastAPI app starts and responds to `GET /health`
- [ ] Async SQLAlchemy connects to PostgreSQL
- [ ] Alembic `init` done, first migration runs
- [ ] Project structure follows modular pattern
- [ ] `.env.example` with all required env vars

**Verification:** `cd backend && uvicorn app.main:app --reload` → `curl localhost:8000/health` returns 200

---

### Task 2: Frontend scaffolding (Next.js 14 + Tailwind + shadcn/ui)
**Description:** Initialize Next.js 14 app with TypeScript, Tailwind CSS v4, shadcn/ui, and base theme configuration from design brief.

**Files:**
- `frontend/` — root frontend directory
- `frontend/src/app/layout.tsx` — root layout with theme provider
- `frontend/src/app/page.tsx` — temp landing page
- `frontend/src/lib/` — utilities
- `frontend/tailwind.config.ts` — theme tokens from design brief
- `frontend/components.json` — shadcn/ui config

**Acceptance Criteria:**
- [ ] Next.js app starts on port 3000
- [ ] Tailwind CSS works with design brief tokens
- [ ] shadcn/ui initialized, at least Button component works
- [ ] Inter + JetBrains Mono fonts loaded
- [ ] Dark theme applied by default

**Verification:** `cd frontend && npm run dev` → page loads with correct dark theme

---

### Task 3: Database schema — users table + initial migration
**Description:** Create the `users` model and Alembic migration. Fields: id, email, password_hash, role (admin/user), display_name, must_change_password, created_at.

**Files:**
- `backend/app/models/user.py`
- `backend/alembic/versions/001_create_users.py`

**Acceptance Criteria:**
- [ ] `users` table created via `alembic upgrade head`
- [ ] Fields match PRD spec
- [ ] `role` is an enum: admin, user
- [ ] `email` has unique constraint
- [ ] Timestamps use UTC

**Verification:** `alembic upgrade head` succeeds, `\d users` shows correct schema

---

### Task 4: Auth API — register, login, me, change-password
**Description:** Implement auth endpoints with bcrypt password hashing and JWT tokens. Admin-only registration. Force password change on first login.

**Files:**
- `backend/app/api/auth.py` — auth router
- `backend/app/core/security.py` — password hashing, JWT create/verify
- `backend/app/schemas/auth.py` — Pydantic request/response schemas
- `backend/app/services/auth.py` — auth business logic

**Acceptance Criteria:**
- [ ] `POST /api/auth/register` — admin creates user (returns temp password)
- [ ] `POST /api/auth/login` — returns JWT (7-day expiry)
- [ ] `GET /api/auth/me` — returns current user (requires valid JWT)
- [ ] `POST /api/auth/change-password` — change password, clears must_change_password
- [ ] Passwords hashed with bcrypt
- [ ] JWT with HS256, includes user_id and role
- [ ] Admin seed command or script to create first admin user

**Verification:** curl login → get token → curl /me with token → 200

---

### Task 5: Auth middleware + role-based access
**Description:** JWT validation middleware for protected routes. Role-based dependency injection (require_admin, require_auth).

**Files:**
- `backend/app/core/deps.py` — get_current_user, require_admin dependencies
- `backend/app/api/users.py` — admin-only user CRUD

**Acceptance Criteria:**
- [ ] All routes except /auth/login require valid JWT
- [ ] Expired/invalid JWT returns 401
- [ ] `require_admin` dependency blocks non-admin users (403)
- [ ] `GET /api/users/` — admin lists all users
- [ ] First-login redirect: if must_change_password=true, API returns flag

**Verification:** Call protected endpoint without token → 401; with user token on admin route → 403

---

### Task 6: Frontend auth — login page + JWT storage + protected routes
**Description:** Login page UI, JWT storage in httpOnly cookie or localStorage, auth context, protected route wrapper.

**Files:**
- `frontend/src/app/login/page.tsx` — login form
- `frontend/src/app/change-password/page.tsx` — forced password change
- `frontend/src/lib/auth.ts` — auth context/provider, token management
- `frontend/src/lib/api.ts` — API client with auth headers
- `frontend/src/middleware.ts` — Next.js middleware for route protection

**Acceptance Criteria:**
- [ ] Login form: email + password, error handling, loading state
- [ ] Successful login stores JWT, redirects to dashboard
- [ ] If must_change_password → redirect to change-password page
- [ ] Unauthenticated users redirected to /login
- [ ] API client attaches JWT to all requests
- [ ] Logout clears token and redirects to /login

**Verification:** Login with valid credentials → redirected to dashboard; visit /tasks without auth → redirected to /login

---

### Task 7: Sidebar navigation + app shell layout
**Description:** Collapsible sidebar with module links (Dashboard, Tasks, Job Hunt, Calendar). App shell with header (user profile, theme toggle) and main content area. Responsive.

**Files:**
- `frontend/src/components/layout/sidebar.tsx`
- `frontend/src/components/layout/header.tsx`
- `frontend/src/components/layout/app-shell.tsx`
- `frontend/src/app/(dashboard)/layout.tsx` — dashboard layout with sidebar

**Acceptance Criteria:**
- [ ] Sidebar: 240px expanded, 48px collapsed, toggle button
- [ ] Nav items: Dashboard, Tasks, Job Hunt, Calendar — with icons (Lucide)
- [ ] Active item highlighted per design brief (accent-muted bg, accent text)
- [ ] Header: user display name, logout button
- [ ] Mobile: sidebar hidden, hamburger menu
- [ ] All styles follow design-brief.md

**Verification:** Navigate between pages via sidebar; collapse/expand works; mobile view shows hamburger

---

### Task 8: Theme toggle (dark/light)
**Description:** Theme switcher using next-themes. Dark theme by default. Persists preference in localStorage. Tailwind dark mode class strategy.

**Files:**
- `frontend/src/components/theme-toggle.tsx`
- `frontend/src/lib/theme-provider.tsx`

**Acceptance Criteria:**
- [ ] Toggle in header switches between dark and light theme
- [ ] Preference persisted across page reloads
- [ ] All colors switch per design-brief.md palette (dark ↔ light)
- [ ] No flash of wrong theme on load (SSR-safe)
- [ ] Default: dark

**Verification:** Toggle theme → colors change; reload → preference persisted

---

### Task 9: Docker Compose for local development
**Description:** Docker Compose with PostgreSQL, backend (FastAPI), and frontend (Next.js) for one-command local setup.

**Files:**
- `docker-compose.yml`
- `backend/Dockerfile`
- `frontend/Dockerfile`
- `.env.example`

**Acceptance Criteria:**
- [ ] `docker compose up` starts all 3 services
- [ ] PostgreSQL accessible on port 5432
- [ ] Backend accessible on port 8000
- [ ] Frontend accessible on port 3000
- [ ] Hot reload works for both frontend and backend
- [ ] Alembic migrations run on backend startup

**Verification:** `docker compose up` → all services healthy; frontend loads login page

---

## Task Dependencies

```
Task 1 (Backend scaffolding)
  └─ Task 3 (DB schema)
       └─ Task 4 (Auth API)
            └─ Task 5 (Auth middleware)

Task 2 (Frontend scaffolding)
  └─ Task 8 (Theme toggle)
  └─ Task 6 (Frontend auth) ← depends on Task 4
       └─ Task 7 (Sidebar + layout) ← depends on Task 6

Task 9 (Docker Compose) ← depends on Tasks 1, 2
```

## Execution Order
1. Task 1 → Task 2 (parallel — independent)
2. Task 3
3. Task 4 → Task 5
4. Task 8 (can start after Task 2)
5. Task 6
6. Task 7
7. Task 9
