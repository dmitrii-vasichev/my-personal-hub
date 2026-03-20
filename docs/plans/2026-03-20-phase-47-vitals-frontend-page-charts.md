# Phase 47: Vitals Frontend — Page & Charts

## Overview
Build the dedicated `/vitals` page with today's summary KPI cards, AI briefing card with markdown rendering, interactive Recharts charts (steps, HR, sleep, stress, Body Battery) with period selector, activities list with type filters, and proper empty state when Garmin is not connected.

## Dependencies
- Phase 44: Vitals Connection & Data Models (merged)
- Phase 45: Vitals Sync & Metrics Collection (merged)
- Phase 46: Vitals AI Daily Briefing (merged)

## Tasks

### Task 1: React Query hooks for all Vitals API endpoints
**Description:** Create `use-vitals.ts` hook file with React Query hooks for all vitals endpoints: today snapshot, metrics (date range), sleep (date range), activities (with pagination), briefing, generate briefing, connection status, and manual sync trigger.
**Files:**
- `frontend/src/hooks/use-vitals.ts` (new)
**Acceptance Criteria:**
- `useVitalsToday()` — GET /api/vitals/today
- `useVitalsMetrics(startDate, endDate)` — GET /api/vitals/metrics
- `useVitalsSleep(startDate, endDate)` — GET /api/vitals/sleep
- `useVitalsActivities(startDate, endDate, limit, offset)` — GET /api/vitals/activities
- `useVitalsBriefing(date?)` — GET /api/vitals/briefing
- `useGenerateBriefing()` — POST /api/vitals/briefing/generate (mutation)
- `useVitalsConnection()` — GET /api/vitals/connection
- `useSyncVitals()` — POST /api/vitals/sync (mutation)
- All mutations invalidate relevant queries on success
- Toast notifications on success/error for mutations
**Verification:** TypeScript compiles, hooks export correctly

### Task 2: TypeScript types for Vitals API responses
**Description:** Create TypeScript interfaces matching the backend Pydantic schemas for all vitals responses.
**Files:**
- `frontend/src/types/vitals.ts` (new)
**Acceptance Criteria:**
- `VitalsDailyMetric` interface with all optional numeric fields (steps, distance_m, calories, HR fields, stress, body_battery, vo2_max)
- `VitalsSleep` interface (duration_seconds, deep/light/rem/awake_seconds, sleep_score, start/end_time)
- `VitalsActivity` interface (garmin_activity_id, activity_type, name, start_time, duration, distance, HR, calories, pace, elevation)
- `VitalsBriefing` interface (id, date, content, generated_at)
- `VitalsTodayResponse` interface (metrics, sleep, recent_activities)
- `VitalsConnectionStatus` interface (connected, last_sync_at, sync_status, sync_interval_minutes)
**Verification:** TypeScript compiles, types used in hooks (Task 1)

### Task 3: Sidebar navigation — add Vitals entry
**Description:** Add "Vitals" item to the sidebar navigation with Heart or Activity icon from lucide-react, positioned after Pulse.
**Files:**
- `frontend/src/components/layout/sidebar.tsx`
**Acceptance Criteria:**
- New nav item: `{ label: "Vitals", href: "/vitals", icon: Heart }` (or Activity)
- Placed after Pulse in the navItems array
- Active state works correctly when on `/vitals` route
- Icon visible in both expanded and collapsed sidebar states
**Verification:** Visual check — icon appears in sidebar, active state works

### Task 4: Vitals page shell and routing
**Description:** Create the `/vitals` page component with basic layout structure: page header with title/subtitle, sync status indicator, "Sync now" button, and content area placeholder. Handle empty state when Garmin is not connected.
**Files:**
- `frontend/src/app/(dashboard)/vitals/page.tsx` (new)
**Acceptance Criteria:**
- Page header: "Vitals" title, "Garmin health metrics & AI insights" subtitle
- Sync status badge showing last sync time (relative, e.g. "5 min ago")
- "Sync now" button (RefreshCw icon) — calls useSyncVitals mutation, shows spinner while syncing
- Demo mode: "Sync now" replaced with DemoModeBadge
- Empty state when not connected: icon + message + "Connect Garmin in Settings" link
- Loading skeleton while connection status loads
**Verification:** Page renders at `/vitals`, empty state shows when not connected, sync button works

### Task 5: Today's Summary KPI cards
**Description:** Create a summary cards component showing today's key vitals as KPI cards: Steps, Resting HR, Sleep Duration, Avg Stress, Body Battery. Each card with icon, value, unit, and colored accent.
**Files:**
- `frontend/src/components/vitals/today-summary.tsx` (new)
**Acceptance Criteria:**
- 5 KPI cards in responsive grid: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-5`
- **Steps**: Footprints icon, formatted number (e.g. "8,432"), teal accent
- **Resting HR**: Heart icon, value + "bpm", red/rose accent
- **Sleep**: Moon icon, hours:minutes format (e.g. "7h 23m" from duration_seconds), indigo accent
- **Stress**: Brain icon, value + "/100", amber accent
- **Body Battery**: Battery icon, "high / low" format (e.g. "87 / 32"), green accent
- Skeleton loading state (5 shimmer cards)
- Handles null/missing data gracefully (shows "—")
**Verification:** Cards render with mock data, handle nulls, responsive layout works

### Task 6: AI Briefing card with markdown rendering
**Description:** Create the AI Briefing card component showing the daily briefing with markdown rendering, generation timestamp, and "Regenerate" button.
**Files:**
- `frontend/src/components/vitals/briefing-card.tsx` (new)
**Acceptance Criteria:**
- Card with "Daily Briefing" title and calendar date display
- Markdown content rendered via ReactMarkdown + remarkGfm with prose styling (same pattern as Pulse digest)
- "Regenerate" button with RefreshCw icon — calls useGenerateBriefing mutation
- Spinner on button while generating
- Generation timestamp shown (relative: "Generated 2h ago")
- Demo mode: Regenerate button replaced with DemoModeBadge
- Empty state: "No briefing yet" message with "Generate" button (or auto-generate hint)
- Loading skeleton while briefing loads
**Verification:** Briefing renders markdown correctly, regenerate works, demo mode shows badge

### Task 7: Period selector component
**Description:** Create a reusable period selector component for charts (7d / 30d / 90d) that computes start/end dates and passes them to parent.
**Files:**
- `frontend/src/components/vitals/period-selector.tsx` (new)
**Acceptance Criteria:**
- Three toggle buttons: "7D", "30D", "90D"
- Default selection: 7D
- Visual active state (filled button vs outline)
- Calls `onChange(startDate, endDate, period)` when selection changes
- Uses date-fns for date math (subDays)
**Verification:** Component renders, switching periods changes dates correctly

### Task 8: Steps bar chart
**Description:** Create a Recharts bar chart showing daily step counts for the selected period.
**Files:**
- `frontend/src/components/vitals/charts/steps-chart.tsx` (new)
**Acceptance Criteria:**
- BarChart with daily step counts
- X-axis: date labels (format: "Mar 15" for 7d, "03/15" for 30d/90d)
- Y-axis: step count with "k" formatter (e.g. "8k")
- Tooltip showing exact value on hover
- Teal bar color matching Steps KPI card
- ResponsiveContainer, height ~250px
- Loading skeleton, empty state for no data
**Verification:** Chart renders with mock data, responsive

### Task 9: Heart rate line chart
**Description:** Create a Recharts line chart showing resting HR trend for the selected period.
**Files:**
- `frontend/src/components/vitals/charts/heart-rate-chart.tsx` (new)
**Acceptance Criteria:**
- LineChart with resting_hr data points
- X-axis: date labels
- Y-axis: bpm with reasonable domain (auto)
- Single line: resting HR (rose/red color)
- Tooltip with bpm value
- Dot markers on data points (for 7d), no dots for 30d/90d
- Loading skeleton, empty state
**Verification:** Chart renders, line smooth, responsive

### Task 10: Sleep stacked bar chart
**Description:** Create a Recharts stacked bar chart showing sleep phase breakdown (deep/light/REM/awake) per night.
**Files:**
- `frontend/src/components/vitals/charts/sleep-chart.tsx` (new)
**Acceptance Criteria:**
- StackedBarChart with 4 segments: Deep (indigo), Light (blue), REM (purple), Awake (amber)
- Values converted from seconds to hours for display
- X-axis: date labels
- Y-axis: hours
- Legend showing phase colors and labels
- Tooltip showing each phase duration (h:mm format)
- Loading skeleton, empty state
**Verification:** Chart renders with stacked segments, legend visible

### Task 11: Stress area chart and Body Battery range chart
**Description:** Create two additional charts — stress daily average as area chart, and Body Battery high/low as range chart.
**Files:**
- `frontend/src/components/vitals/charts/stress-chart.tsx` (new)
- `frontend/src/components/vitals/charts/body-battery-chart.tsx` (new)
**Acceptance Criteria:**
- **Stress**: AreaChart with avg_stress, amber fill with opacity, Y-axis 0-100
- **Body Battery**: AreaChart showing range between body_battery_low and body_battery_high, green fill. Two lines for high and low bounds, filled area between them.
- Both: date X-axis, tooltip, loading skeleton, empty state
**Verification:** Both charts render correctly with mock data

### Task 12: Charts section — composite component with period selector
**Description:** Create a charts section component that combines the period selector with all 5 charts in a responsive grid layout. Fetches metrics and sleep data for the selected period.
**Files:**
- `frontend/src/components/vitals/charts-section.tsx` (new)
**Acceptance Criteria:**
- Section header "Trends" with PeriodSelector
- On period change: re-fetch metrics and sleep data via hooks
- Charts layout: 2-column grid on desktop, 1-column on mobile
- Each chart wrapped in a Card with title
- Charts order: Steps, Heart Rate, Sleep, Stress, Body Battery
- Loading states propagated to individual charts
**Verification:** Period switch triggers data refetch, charts update

### Task 13: Activities list with type filter
**Description:** Create an activities list component showing recent activities with type icon, name, duration, distance, HR, date. Filterable by activity type.
**Files:**
- `frontend/src/components/vitals/activities-list.tsx` (new)
**Acceptance Criteria:**
- List of activities in Card container with "Activities" header
- Each row: type icon (Running→footprints, Cycling→bike, etc.), activity name, duration (formatted), distance (km), avg HR, date
- Filter dropdown: "All types" + unique activity types from data
- Shows last 20 activities, "Load more" button for pagination
- Fallback icon for unknown activity types
- Loading skeleton (3 shimmer rows), empty state
**Verification:** Activities render, filter works, pagination loads more

### Task 14: Assemble full Vitals page
**Description:** Integrate all components into the Vitals page: Today's Summary → Briefing → Charts → Activities. Wire up all hooks and data flow.
**Files:**
- `frontend/src/app/(dashboard)/vitals/page.tsx` (update)
**Acceptance Criteria:**
- Page sections in order: TodaySummary, BriefingCard, ChartsSection, ActivitiesList
- All data fetched via hooks from Task 1
- Connection check: if not connected → show empty state instead of all sections
- Loading states for each section independently
- Responsive layout works on mobile/tablet/desktop
- Page title in browser tab: "Vitals | Personal Hub"
**Verification:** Full page renders with all sections, data flows correctly, empty state works

### Task 15: Frontend tests for Vitals components
**Description:** Write tests for key Vitals components: today summary cards, briefing card, activities list, and the page-level empty state handling.
**Files:**
- `frontend/__tests__/vitals.test.tsx` (new)
**Acceptance Criteria:**
- Test TodaySummary: renders 5 KPI cards with correct values, handles null metrics
- Test BriefingCard: renders markdown content, shows regenerate button, shows demo badge in demo mode
- Test ActivitiesList: renders activity rows, filter changes displayed items
- Test VitalsPage empty state: shows "Connect Garmin" when not connected
- All mocks follow existing patterns (vi.mock for hooks, toast, auth)
- Minimum 8 test cases
**Verification:** `npm test` passes all new tests

## Execution Order

```
Task 2 (types) → Task 1 (hooks) → Task 3 (sidebar) ─┐
                                                       ├→ Task 4 (page shell)
                                                       │
Task 5 (KPI cards) ──────────────────────────────────→ │
Task 6 (briefing card) ──────────────────────────────→ │
Task 7 (period selector) → Task 8-11 (charts) ──────→ │
  → Task 12 (charts section) ────────────────────────→ │
Task 13 (activities list) ──────────────────────────→  │
                                                       ├→ Task 14 (assemble page)
                                                       └→ Task 15 (tests)
```

Tasks 3, 5, 6, 7, 13 can be developed in parallel after Tasks 1-2 are done.

## Technical Notes
- Use existing patterns from Pulse page for markdown rendering (ReactMarkdown + remarkGfm + prose classes)
- Use existing summary-cards.tsx pattern for KPI cards styling
- Recharts v3.8.0 is already installed — use ResponsiveContainer for all charts
- date-fns v4 for all date formatting and math
- Follow existing color scheme: teal, rose, indigo, amber, green accents via CSS variables
- Demo mode check via `useAuth().isDemo`
