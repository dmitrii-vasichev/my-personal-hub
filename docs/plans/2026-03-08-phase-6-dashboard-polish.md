# Phase 6: Dashboard & Polish

**Date:** 2026-03-08
**Phase:** 6 of 6
**PRD Reference:** docs/prd-personal-hub.md
**Design Reference:** docs/design-brief.md

---

## Overview

Final phase — build the dashboard home page with summary cards and charts, add task reminders, link tasks to calendar events, add task analytics, and prepare production deployment configs.

---

## Tasks

### Task 1: Dashboard summary API endpoint

**Description:** Create a unified `/api/dashboard/summary` endpoint that aggregates data across all modules: tasks (total, by status, overdue, completion rate), job hunt (active applications, upcoming interviews, avg ATS score), and calendar (upcoming events in next 7 days).

**Files:**
- `backend/app/api/dashboard.py` (new)
- `backend/app/services/dashboard.py` (new)
- `backend/app/main.py` (register router)

**Acceptance Criteria:**
- [ ] `GET /api/dashboard/summary` returns aggregated metrics
- [ ] Includes task stats: total, by_status, overdue_count, completion_rate
- [ ] Includes job hunt stats: active_applications, upcoming_interviews, avg_ats_score
- [ ] Includes calendar stats: upcoming_events (next 7 days count + list of titles/times)
- [ ] Auth required (401 without token)
- [ ] Tests pass

**Verification:** `pytest tests/test_dashboard.py` + manual curl

---

### Task 2: Dashboard home page — summary cards

**Description:** Replace the placeholder dashboard page with summary cards showing key metrics from the dashboard API. Cards: "Active Tasks", "Overdue Tasks", "Open Applications", "Upcoming Events". Each card shows a number + trend indicator. Use design-brief colors and card styles.

**Files:**
- `frontend/src/app/(dashboard)/page.tsx` (rewrite)
- `frontend/src/components/dashboard/summary-cards.tsx` (new)
- `frontend/src/hooks/use-dashboard.ts` (new)
- `frontend/src/types/dashboard.ts` (new)

**Acceptance Criteria:**
- [ ] Dashboard shows 4 summary cards in a responsive grid (2x2 on desktop, 1 column mobile)
- [ ] Cards display: icon, label, value, optional subtitle
- [ ] Loading skeleton while data fetches
- [ ] Follows design-brief styling (card radius, colors, spacing)
- [ ] Tests: component renders without errors

**Verification:** Visual check in browser + component test

---

### Task 3: Dashboard — recent activity feed

**Description:** Add a "Recent Activity" section below summary cards showing the last 10 actions across modules: task status changes, new applications, upcoming calendar events. Reuse existing endpoints (task updates, applications list, calendar events).

**Files:**
- `frontend/src/components/dashboard/recent-activity.tsx` (new)
- `frontend/src/app/(dashboard)/page.tsx` (integrate)

**Acceptance Criteria:**
- [ ] Shows last 10 items from task updates + application changes + calendar events
- [ ] Each item shows: icon (by type), title, timestamp (relative: "2h ago")
- [ ] Clicking an item navigates to the relevant detail page
- [ ] Empty state if no activity
- [ ] Tests: component renders without errors

**Verification:** Visual check + component test

---

### Task 4: Task analytics — backend service & endpoints

**Description:** Add task analytics endpoints following the existing job hunt analytics pattern. Metrics: status distribution, completion rate over time (weekly), overdue trend, average time-to-complete, tasks by priority.

**Files:**
- `backend/app/services/task_analytics.py` (new)
- `backend/app/api/task_analytics.py` (new)
- `backend/app/main.py` (register router)

**Acceptance Criteria:**
- [ ] `GET /api/task-analytics/status-distribution` — count per status
- [ ] `GET /api/task-analytics/completion-rate` — weekly completion rate (last 12 weeks)
- [ ] `GET /api/task-analytics/overdue` — overdue tasks count + list
- [ ] `GET /api/task-analytics/priority-distribution` — count per priority
- [ ] Auth required on all endpoints
- [ ] Tests pass

**Verification:** `pytest tests/test_task_analytics.py` + manual curl

---

### Task 5: Task analytics — frontend page

**Description:** Add a "Task Analytics" page accessible from sidebar or tasks page. Display charts: status distribution (donut), completion rate (line chart), priority breakdown (bar chart), overdue tasks list. Use recharts (already installed).

**Files:**
- `frontend/src/app/(dashboard)/tasks/analytics/page.tsx` (new)
- `frontend/src/components/tasks/analytics/` (new directory with chart components)
- `frontend/src/hooks/use-task-analytics.ts` (new)
- `frontend/src/types/task-analytics.ts` (new)
- `frontend/src/components/layout/sidebar.tsx` (add nav link)

**Acceptance Criteria:**
- [ ] Page shows 4 chart sections: status donut, completion line, priority bar, overdue list
- [ ] Charts use design-brief accent colors
- [ ] Responsive layout (stacks on mobile)
- [ ] Sidebar link or tasks page tab to navigate to analytics
- [ ] Tests: page renders without errors

**Verification:** Visual check + component test

---

### Task 6: Task reminders — backend notification check

**Description:** Add a `/api/tasks/reminders/due` endpoint that returns tasks where `reminder_at` is within the next 15 minutes and reminder hasn't been dismissed. Add `reminder_dismissed` boolean field to Task model via Alembic migration.

**Files:**
- `backend/app/models/task.py` (add `reminder_dismissed` field)
- `alembic/versions/xxx_add_reminder_dismissed.py` (new migration)
- `backend/app/api/tasks.py` (add reminder endpoints)
- `backend/app/services/task.py` (add reminder query)
- `backend/app/schemas/task.py` (update schema)

**Acceptance Criteria:**
- [ ] `GET /api/tasks/reminders/due` returns tasks with reminder_at in past or within 15 min
- [ ] `POST /api/tasks/{id}/reminders/dismiss` marks reminder as dismissed
- [ ] Migration runs clean (upgrade + downgrade)
- [ ] Setting `reminder_at` on task create/update works
- [ ] Tests pass

**Verification:** `pytest tests/test_task_reminders.py` + alembic check

---

### Task 7: Task reminders — frontend notification UI

**Description:** Add a polling mechanism (every 60s) that checks for due reminders and shows toast notifications (using sonner). Add a reminder picker in the task dialog to set `reminder_at`.

**Files:**
- `frontend/src/components/tasks/reminder-poller.tsx` (new)
- `frontend/src/components/tasks/task-dialog.tsx` (add reminder picker)
- `frontend/src/hooks/use-task-reminders.ts` (new)
- `frontend/src/components/layout/app-shell.tsx` (mount poller)

**Acceptance Criteria:**
- [ ] Poller runs every 60s and shows toast for due reminders
- [ ] Toast shows task title + deadline, click navigates to task
- [ ] Task dialog has reminder date/time picker
- [ ] Dismissing toast calls dismiss endpoint
- [ ] Tests: poller component renders, reminder hook works

**Verification:** Set reminder 1 min in future → see toast appear

---

### Task 8: Link tasks to calendar events — backend

**Description:** Add a many-to-many relationship between tasks and calendar events via a join table. Add endpoints to link/unlink tasks from events, and include linked tasks/events in existing detail endpoints.

**Files:**
- `backend/app/models/task_event_link.py` (new model)
- `alembic/versions/xxx_add_task_event_links.py` (new migration)
- `backend/app/api/tasks.py` (add link endpoints)
- `backend/app/api/calendar.py` (add link endpoints)
- `backend/app/schemas/task.py` (add linked_events field)
- `backend/app/schemas/calendar.py` (add linked_tasks field)

**Acceptance Criteria:**
- [ ] `POST /api/tasks/{id}/events/{event_id}` links task to event
- [ ] `DELETE /api/tasks/{id}/events/{event_id}` unlinks
- [ ] `GET /api/tasks/{id}` includes linked_events list
- [ ] `GET /api/calendar/events/{id}` includes linked_tasks list
- [ ] Migration runs clean
- [ ] Tests pass

**Verification:** `pytest tests/test_task_event_links.py`

---

### Task 9: Link tasks to calendar events — frontend UI

**Description:** Add UI to link tasks to events from both sides: task detail page shows linked events with an "Add event" picker, event detail page shows linked tasks with an "Add task" picker. Use existing combobox/select patterns.

**Files:**
- `frontend/src/components/tasks/linked-events.tsx` (new)
- `frontend/src/components/calendar/linked-tasks.tsx` (new)
- `frontend/src/app/(dashboard)/tasks/[id]/page.tsx` (integrate)
- `frontend/src/app/(dashboard)/calendar/[id]/page.tsx` (integrate)
- `frontend/src/hooks/use-task-event-links.ts` (new)

**Acceptance Criteria:**
- [ ] Task detail shows linked events as clickable pills
- [ ] Event detail shows linked tasks as clickable pills
- [ ] "Link event/task" button opens a search-select dropdown
- [ ] Can unlink with X button on pill
- [ ] Tests: components render without errors

**Verification:** Visual check + link/unlink flow

---

### Task 10: Production deployment configuration

**Description:** Add production deployment configs for Vercel (frontend) and Railway (backend). Update CORS, environment variable docs, and add health check endpoint.

**Files:**
- `frontend/vercel.json` (new)
- `backend/railway.toml` (new)
- `backend/app/api/health.py` (new — `GET /api/health`)
- `backend/app/main.py` (register health route, update CORS)
- `backend/app/core/config.py` (add CORS_ORIGINS env var)
- `.env.example` (update with production vars)
- `README.md` (add deployment section)

**Acceptance Criteria:**
- [ ] `vercel.json` configures rewrites to backend API
- [ ] `railway.toml` configures build & start commands
- [ ] `GET /api/health` returns `{"status": "ok"}` (no auth)
- [ ] CORS accepts configurable origins via env var
- [ ] `.env.example` documents all required env vars
- [ ] README has deployment instructions
- [ ] Tests: health endpoint test

**Verification:** `pytest tests/test_health.py` + config review

---

## Task Dependencies

```
Task 1 (Dashboard API) ──→ Task 2 (Summary Cards) ──→ Task 3 (Activity Feed)
Task 4 (Task Analytics BE) ──→ Task 5 (Task Analytics FE)
Task 6 (Reminders BE) ──→ Task 7 (Reminders FE)
Task 8 (Task-Event Link BE) ──→ Task 9 (Task-Event Link FE)
Task 10 (Deployment) — independent
```

**Parallel groups:**
- Group A: Tasks 1 → 2 → 3 (Dashboard)
- Group B: Tasks 4 → 5 (Task Analytics)
- Group C: Tasks 6 → 7 (Reminders)
- Group D: Tasks 8 → 9 (Task-Event Links)
- Group E: Task 10 (Deployment)

Groups A-E are independent from each other and can be done in any order.

**Recommended sequential order:** 1, 2, 3, 4, 5, 6, 7, 8, 9, 10

---

## Estimated Effort

| Task | Effort |
|------|--------|
| Task 1: Dashboard API | ~20 min |
| Task 2: Summary Cards UI | ~25 min |
| Task 3: Activity Feed | ~20 min |
| Task 4: Task Analytics BE | ~20 min |
| Task 5: Task Analytics FE | ~25 min |
| Task 6: Reminders BE | ~20 min |
| Task 7: Reminders FE | ~25 min |
| Task 8: Task-Event Link BE | ~20 min |
| Task 9: Task-Event Link FE | ~20 min |
| Task 10: Deployment Config | ~15 min |
| **Total** | **~210 min** |
