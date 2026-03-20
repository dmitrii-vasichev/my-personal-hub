# Phase 48: Vitals Frontend — Dashboard Widget, Settings & Demo

**Date:** 2026-03-20
**PRD:** docs/prd-vitals.md
**Depends on:** Phase 47 (Vitals Frontend — Page & Charts)
**Estimated tasks:** 12

---

## Task 1: Backend — Add briefing_insight to dashboard summary endpoint

**Description:** Update the `/api/dashboard/vitals-summary` endpoint to include a one-line AI insight extracted from today's briefing. Extract the first meaningful sentence from VitalsBriefing content.

**Files:**
- `backend/app/schemas/garmin.py` — add `briefing_insight: Optional[str]` to `VitalsDashboardSummaryResponse`
- `backend/app/api/garmin.py` — update `get_vitals_summary()` to fetch today's briefing and extract first sentence

**Acceptance Criteria:**
- `VitalsDashboardSummaryResponse` includes `briefing_insight` field
- Endpoint returns first sentence from today's briefing content (strip markdown headers)
- Returns `null` if no briefing exists for today
- Existing fields unchanged

**Verification:** `pytest backend/tests/ -k vitals` passes; manual curl test returns `briefing_insight`

---

## Task 2: Frontend — Update VitalsDashboardSummary type and add hook

**Description:** Update the TypeScript type to include `briefing_insight` and create a React Query hook for the dashboard widget endpoint.

**Files:**
- `frontend/src/types/vitals.ts` — add `briefing_insight: string | null` to `VitalsDashboardSummary`
- `frontend/src/hooks/use-vitals.ts` — add `useVitalsDashboardSummary()` hook for `/api/dashboard/vitals-summary`

**Acceptance Criteria:**
- `VitalsDashboardSummary` type includes `briefing_insight`
- `useVitalsDashboardSummary()` hook returns typed data from `/api/dashboard/vitals-summary`
- Hook uses `[VITALS_KEY, "dashboard"]` query key

**Verification:** TypeScript compilation passes, no type errors

---

## Task 3: Frontend — VitalsWidget component

**Description:** Create the Vitals dashboard widget showing Body Battery gauge, steps progress, sleep duration, resting HR, and stress level for today. Includes one-line AI insight at bottom.

**Files:**
- `frontend/src/components/dashboard/vitals-widget.tsx` — new component

**Acceptance Criteria:**
- Shows 5 KPI items: Body Battery (high/low), steps (with /10k goal), sleep duration (hours), resting HR (bpm), stress level
- One-line AI insight at bottom from `briefing_insight`
- "View details" link to `/vitals`
- Skeleton loading state (matching PulseDigestWidget pattern)
- Empty state when Garmin not connected: "Connect Garmin in Settings"
- Card header with Heart icon and accent color (accent-rose)
- Follows PulseDigestWidget card pattern: `rounded-xl border border-border-subtle bg-card`

**Verification:** Visual inspection, component renders without errors

---

## Task 4: Frontend — Add VitalsWidget to dashboard page

**Description:** Integrate the VitalsWidget into the dashboard page layout.

**Files:**
- `frontend/src/app/(dashboard)/page.tsx` — add VitalsWidget to grid

**Acceptance Criteria:**
- VitalsWidget appears in the two-column grid alongside Pulse and RecentActivity
- Layout: 3 widgets in grid — Pulse (left), VitalsWidget (right top), RecentActivity (full width below) OR 2x2 grid depending on visual balance
- Grid adjusts responsively: single column on mobile, two columns on desktop

**Verification:** Visual inspection at various breakpoints

---

## Task 5: Frontend — GarminSettingsTab component

**Description:** Create the Garmin settings tab with connect/disconnect form and sync interval selector. Follows TelegramTab pattern — self-contained component managing its own state via API.

**Files:**
- `frontend/src/components/settings/garmin-tab.tsx` — new component

**Acceptance Criteria:**
- **Disconnected state:** email + password fields, "Connect" button. Uses `ApiKeyInput`-style password field
- **Connected state:** shows connected_at, last_sync_at, sync status. "Sync now" button. Sync interval dropdown (1h, 2h, 4h, 6h, 12h, 24h). "Disconnect" button with confirmation
- Uses `useVitalsConnection()` hook for status, `useSyncVitals()` for manual sync
- Connect calls `POST /api/vitals/connect` with email + password
- Disconnect calls `DELETE /api/vitals/disconnect`
- Sync interval change calls `PATCH /api/vitals/sync-interval`
- Section wrapped in `rounded-lg border border-border p-5` (matches other tabs)

**Verification:** Visual inspection, connect/disconnect flow works with API

---

## Task 6: Frontend — Settings page integration

**Description:** Add "Garmin" tab to the settings page, visible for admin users (not demo).

**Files:**
- `frontend/src/app/(dashboard)/settings/page.tsx` — add tab entry and GarminTab rendering

**Acceptance Criteria:**
- New tab "Garmin" appears after "Pulse" in the tab list
- Tab visible only for `isAdmin && !isDemo` (same as other integration tabs)
- Tab renders `<GarminTab />` component
- Tab order: General, Tags, AI & API Keys, AI Instructions, AI KB, Integrations, Telegram, Pulse, **Garmin**, Users

**Verification:** Tab appears for admin, hidden for demo user

---

## Task 7: Frontend — Demo mode restrictions on Vitals page

**Description:** Add demo badges and disable mutations on the Vitals page for demo users.

**Files:**
- `frontend/src/app/(dashboard)/vitals/page.tsx` — add demo checks
- `frontend/src/components/vitals/today-summary.tsx` — disable "Sync now" for demo
- `frontend/src/components/vitals/briefing-card.tsx` — disable "Regenerate" for demo, show badge

**Acceptance Criteria:**
- "Sync now" button disabled with "Demo" badge for demo users
- "Regenerate" briefing button disabled with "Demo" badge for demo users
- All view features (charts, metrics, activities list) work normally with seeded data
- Empty state does NOT appear for demo user (data is seeded, connection simulated)
- Badge style: `text-xs bg-accent-amber/15 text-accent-amber px-1.5 py-0.5 rounded` (matches existing pattern)

**Verification:** Login as demo user, verify badges appear, buttons disabled, data displays

---

## Task 8: Backend — Demo seed data for Vitals

**Description:** Add vitals seed data to `seed_demo.py`: 30 days of daily metrics, sleep data, 15 activities, GarminConnection (simulated), and pre-written AI briefing.

**Files:**
- `backend/app/scripts/seed_demo.py` — add `create_vitals_data()` function, add import for garmin models, call from `seed()`

**Acceptance Criteria:**
- GarminConnection created with simulated status (connected=true, encrypted_email/password can be dummy)
- 30 days of VitalsDailyMetric: realistic ranges (steps 6k-12k, resting HR 58-72, sleep scores 60-90, stress 20-45, Body Battery 30-95)
- 30 days of VitalsSleep: 6-8.5h duration, varying deep/light/REM
- 15 VitalsActivity records: mix of running (5K-10K), cycling, walking, strength
- 1 VitalsBriefing for today: pre-written markdown referencing demo user's tasks/calendar
- All records bound to demo user_id
- Seed is idempotent (cascade delete handles cleanup)

**Verification:** `python -m app.scripts.seed_demo` runs without errors; API returns vitals data for demo user

---

## Task 9: Backend tests — Demo vitals data and dashboard summary

**Description:** Add tests for the demo vitals seed data and the updated dashboard summary endpoint.

**Files:**
- `backend/tests/test_vitals_demo.py` — new test file

**Acceptance Criteria:**
- Test that `get_vitals_summary` returns `briefing_insight` when briefing exists
- Test that `briefing_insight` is `null` when no briefing
- Test that demo user can read vitals metrics, sleep, activities, briefing
- Test that demo user cannot call connect, disconnect, sync, briefing/generate (403)

**Verification:** `pytest backend/tests/test_vitals_demo.py -v` passes

---

## Task 10: Frontend tests — VitalsWidget

**Description:** Add tests for the dashboard VitalsWidget component.

**Files:**
- `frontend/src/components/dashboard/__tests__/vitals-widget.test.tsx` — new test file

**Acceptance Criteria:**
- Test loading skeleton renders
- Test connected state renders all 5 KPI items
- Test AI insight line renders when present
- Test empty state renders when not connected
- Test "View details" link points to `/vitals`

**Verification:** `npx jest vitals-widget.test` passes

---

## Task 11: Frontend tests — GarminSettingsTab

**Description:** Add tests for the GarminSettingsTab component.

**Files:**
- `frontend/src/components/settings/__tests__/garmin-tab.test.tsx` — new test file

**Acceptance Criteria:**
- Test disconnected state shows email + password fields and Connect button
- Test connected state shows status info, sync interval, Disconnect button
- Test connect form submission calls correct API
- Test sync interval change calls correct API

**Verification:** `npx jest garmin-tab.test` passes

---

## Task 12: Frontend tests — Vitals demo restrictions

**Description:** Add tests verifying demo mode restrictions on the Vitals page.

**Files:**
- `frontend/src/components/vitals/__tests__/vitals-demo.test.tsx` — new test file

**Acceptance Criteria:**
- Test that "Sync now" button is disabled and shows badge for demo user
- Test that "Regenerate" button is disabled and shows badge for demo user
- Test that metrics/charts render normally for demo user

**Verification:** `npx jest vitals-demo.test` passes

---

## Dependency Order

```
Task 1 (backend: briefing_insight)
  → Task 2 (frontend: type + hook)
    → Task 3 (frontend: VitalsWidget)
      → Task 4 (frontend: dashboard integration)
        → Task 10 (tests: VitalsWidget)

Task 5 (frontend: GarminSettingsTab)
  → Task 6 (frontend: settings integration)
    → Task 11 (tests: GarminSettingsTab)

Task 7 (frontend: demo restrictions)
  → Task 12 (tests: demo restrictions)

Task 8 (backend: demo seed)
  → Task 9 (tests: demo seed)
```

Tasks 1, 5, 7, 8 can start in parallel.
