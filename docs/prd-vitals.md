# PRD: Vitals — Garmin Health Metrics & AI Daily Briefing

## Metadata
| Field | Value |
|-------|-------|
| Author | Dmitry Vasichev |
| Date | 2026-03-19 |
| Status | Approved |
| Priority | P1 |

## Problem Statement

The Personal Hub tracks tasks, jobs, calendar, and information streams — but ignores the physical dimension that directly affects productivity. Sleep quality, stress levels, and energy reserves determine how effectively a person works, yet this data sits isolated in the Garmin Connect app. There is no way to correlate health metrics with productivity patterns or receive actionable recommendations that combine both perspectives.

**Vitals** bridges this gap by syncing Garmin health data into the hub, visualizing trends over time, and generating a daily AI briefing that connects physical state with upcoming tasks, meetings, and job search activities.

## Goals & Non-Goals

### Goals
- Connect Garmin account and sync health data automatically on a configurable schedule
- Store and display key health metrics: steps, heart rate, sleep, stress, Body Battery, activities, VO2 Max
- Visualize trends with interactive charts (daily/weekly/monthly)
- Generate an AI-powered Daily Briefing that cross-references health data with tasks, calendar, and job hunt status
- Provide a dashboard widget with today's key vitals + mini-briefing
- Integrate with demo mode (pre-seeded realistic data, no real Garmin sync)

### Non-Goals
- Real-time streaming from Garmin (sync is periodic, not live)
- Garmin watch app or Connect IQ development
- Workout planning or training program generation
- Medical advice or health diagnosis
- Support for other fitness platforms (Fitbit, Apple Health, etc.) — Garmin only for MVP
- Nutrition/hydration tracking (may be added later)
- Data export or sharing with third parties

## User Scenarios

### Scenario 1: Connect Garmin Account
**As a** hub user, **I want to** enter my Garmin credentials in Settings, **so that** the system can sync my health data automatically.

### Scenario 2: View Daily Vitals
**As a** hub user, **I want to** see today's key metrics (steps, HR, sleep, stress, Body Battery) at a glance, **so that** I understand my current physical state.

### Scenario 3: Explore Trends
**As a** hub user, **I want to** view charts of my health metrics over days/weeks/months, **so that** I can spot patterns and track improvement.

### Scenario 4: Read Daily Briefing
**As a** hub user, **I want to** read an AI-generated briefing that combines my health data with my work schedule, **so that** I can plan my day optimally (e.g., schedule hard tasks when energy is high).

### Scenario 5: Pre-Interview Wellness Check
**As a** job seeker, **I want to** see my sleep quality and stress levels before an important interview, **so that** I know if I'm physically prepared and can adjust if needed.

### Scenario 6: Productivity Correlations
**As a** hub user, **I want to** see how my sleep and stress correlate with task completion rates, **so that** I can identify what lifestyle factors impact my productivity.

### Scenario 7: Dashboard Quick Look
**As a** hub user, **I want to** see a compact vitals widget on the dashboard with today's metrics and a one-line AI insight, **so that** I don't need to open the full Vitals page for a quick check.

## Functional Requirements

### P0 (Must Have)

#### Garmin Connection
- [ ] FR-1: Garmin authentication via `garminconnect` library — email + password login
- [ ] FR-2: Encrypted credential storage using Fernet (same pattern as Telegram/Google tokens)
- [ ] FR-3: OAuth token persistence via Garth — store tokens in DB, auto-refresh (tokens live ~1 year)
- [ ] FR-4: MFA support — if Garmin requires 2FA, prompt user for code via UI flow
- [ ] FR-5: Connection status indicator (connected/disconnected/error) in Settings
- [ ] FR-6: Disconnect Garmin — clear credentials and tokens, stop sync
- [ ] FR-7: Credentials bound to `user_id`, inaccessible to other users

#### Data Models
- [ ] FR-8: `GarminConnection` model — user_id, encrypted credentials, token path, last_sync_at, sync_status, sync_interval_minutes
- [ ] FR-9: `VitalsDailyMetric` model — user_id, date (unique per user), steps, distance_m, calories_active, calories_total, floors_climbed, intensity_minutes, resting_hr, avg_hr, max_hr, min_hr, avg_stress, max_stress, body_battery_high, body_battery_low, vo2_max, raw_json (full API response for future use)
- [ ] FR-10: `VitalsSleep` model — user_id, date, duration_seconds, deep_seconds, light_seconds, rem_seconds, awake_seconds, sleep_score, start_time, end_time
- [ ] FR-11: `VitalsActivity` model — user_id, garmin_activity_id (unique), activity_type, name, start_time, duration_seconds, distance_m, avg_hr, max_hr, calories, avg_pace, elevation_gain, raw_json
- [ ] FR-12: `VitalsBriefing` model — user_id, date (unique per user), content (markdown), health_data_json (snapshot), tasks_data_json (snapshot), calendar_data_json (snapshot), jobs_data_json (snapshot), generated_at

#### Data Sync
- [ ] FR-13: Periodic sync via APScheduler (same pattern as Pulse polling) — default interval: 4 hours, configurable per user (1h, 2h, 4h, 6h, 12h, 24h)
- [ ] FR-14: Sync fetches data for current day + previous day (to catch late-arriving sleep data)
- [ ] FR-15: Upsert logic — update if record for date exists, create if not
- [ ] FR-16: Sync activities by date range (last 7 days on first sync, last 2 days on subsequent)
- [ ] FR-17: Error handling — log errors, set connection status to "error" with message, retry on next interval
- [ ] FR-18: Manual "Sync now" button in Vitals page and Settings

#### API Endpoints
- [ ] FR-19: `POST /api/vitals/connect` — save Garmin credentials, attempt login, trigger initial sync
- [ ] FR-20: `POST /api/vitals/disconnect` — clear credentials and data (optional: keep historical data)
- [ ] FR-21: `GET /api/vitals/connection` — connection status, last sync time
- [ ] FR-22: `POST /api/vitals/sync` — trigger manual sync
- [ ] FR-23: `GET /api/vitals/metrics?start_date=&end_date=` — daily metrics for date range
- [ ] FR-24: `GET /api/vitals/sleep?start_date=&end_date=` — sleep data for date range
- [ ] FR-25: `GET /api/vitals/activities?start_date=&end_date=&limit=&offset=` — activities with pagination
- [ ] FR-26: `GET /api/vitals/today` — today's snapshot (metrics + sleep + recent activities)
- [ ] FR-27: `GET /api/vitals/briefing?date=` — AI briefing for date (generate if not cached)
- [ ] FR-28: `POST /api/vitals/briefing/generate` — force regenerate today's briefing
- [ ] FR-29: `GET /api/dashboard/vitals-summary` — compact data for dashboard widget

### P1 (Should Have)

#### AI Daily Briefing
- [ ] FR-30: AI briefing generation using configured LLM (same provider as Pulse digests)
- [ ] FR-31: Cross-module data assembly for briefing prompt:
  - **Health**: sleep score/duration, Body Battery, stress, resting HR, yesterday's activities
  - **Tasks**: active tasks count, overdue count, today's deadlines, completion rate (7-day)
  - **Calendar**: today's events (meetings, interviews), free time blocks
  - **Jobs**: upcoming interviews (next 3 days), active applications count, pending actions
- [ ] FR-32: Briefing structure (markdown):
  - **Health Status** — sleep quality, energy level, stress assessment
  - **Day Forecast** — workload overview based on tasks + calendar
  - **Recommendations** — when to tackle hard tasks, break suggestions, pre-interview prep notes
  - **Correlations** — notable patterns (e.g., "sleep improved 15% this week, task completion up 20%")
- [ ] FR-33: Briefing caching — generate once per day, serve cached version until manual regeneration
- [ ] FR-34: Briefing generation triggered automatically after morning sync (if data available)

#### Vitals Page UI
- [ ] FR-35: Dedicated `/vitals` page with sidebar navigation entry (icon: Heart or Activity)
- [ ] FR-36: Today's Summary Card — steps, HR, sleep duration, stress, Body Battery as KPI cards with colored accents
- [ ] FR-37: AI Briefing Card — rendered markdown, "Regenerate" button, generation timestamp
- [ ] FR-38: Trends Charts (Recharts) — period selector (7d / 30d / 90d):
  - Steps bar chart (daily)
  - Heart rate line chart (resting HR trend)
  - Sleep stacked bar chart (deep/light/REM/awake)
  - Stress area chart (daily average)
  - Body Battery range chart (high/low per day)
- [ ] FR-39: Activities List — recent activities with type icon, name, duration, distance, HR, date. Filterable by type.
- [ ] FR-40: "Sync now" button with last sync timestamp and status indicator
- [ ] FR-41: Empty state when Garmin not connected — prompt to connect in Settings

#### Dashboard Widget
- [ ] FR-42: "Vitals" widget on dashboard page (in the existing grid alongside Pulse + Recent Activity)
- [ ] FR-43: Widget shows: Body Battery gauge, steps progress (vs 10k goal), sleep duration, resting HR, stress level — all for today
- [ ] FR-44: One-line AI insight at bottom (extracted from briefing, e.g., "Good energy. Best focus window: 9-12 AM")
- [ ] FR-45: "View details" link → /vitals page
- [ ] FR-46: Skeleton loading state while data loads
- [ ] FR-47: Graceful fallback when Garmin not connected — "Connect Garmin in Settings" message

#### Settings Integration
- [ ] FR-48: "Garmin" section in Settings → Integrations tab (alongside Google, Telegram)
- [ ] FR-49: Connection form: email + password fields, "Connect" button
- [ ] FR-50: Connected state: shows account name, last sync, sync interval selector, "Disconnect" button
- [ ] FR-51: Sync interval dropdown: 1h, 2h, 4h (default), 6h, 12h, 24h

### P2 (Nice to Have)
- [ ] FR-52: Productivity correlation charts — overlay task completion rate with sleep/stress trends
- [ ] FR-53: Weekly summary briefing (generated on Monday morning)
- [ ] FR-54: Activity type breakdown pie chart
- [ ] FR-55: Personal records display (from Garmin PR data)
- [ ] FR-56: VO2 Max trend chart with fitness age

## Demo Mode

For demo users (role=`demo`):
- Pre-seeded 30 days of realistic daily metrics, sleep data, and activities
- Pre-seeded AI briefing for today
- Garmin connection shows as "connected" (simulated)
- "Sync now" disabled with demo badge
- "Connect/Disconnect" disabled with demo badge in Settings
- All view features work normally with seeded data

**Seed Data:**
- Daily metrics: realistic step counts (6k-12k), HR (58-72 resting), sleep scores (60-90), stress (20-45 avg), Body Battery (30-95)
- Sleep: 6-8.5 hours, varying deep/light/REM phases
- Activities (15 over 30 days): runs (5K-10K), cycling, walks, strength training
- Briefing: pre-written example referencing demo user's tasks and calendar

## Access Matrix Update

| Feature | Admin | Member | Demo |
|---------|-------|--------|------|
| **Vitals** — view metrics/charts | yes | yes | yes (seeded data) |
| **Vitals** — AI briefing view | yes | yes | yes (seeded) |
| **Vitals** — AI briefing generate | yes | yes | no (badge) |
| **Vitals** — sync now | yes | yes | no (badge) |
| **Vitals** — connect/disconnect | yes | yes | no (badge) |
| **Settings** — Garmin credentials | yes | yes | no (hidden) |

## Technical Notes

### garminconnect Library
- Package: `garminconnect` (PyPI), auth via `garth` library
- Login with email/password → receive OAuth1 token (~1 year lifetime) + auto-refreshing OAuth2 token
- **Critical**: login with credentials only once, then persist tokens. Repeated logins trigger rate limiting (HTTP 429, ~1 hour cooldown)
- Token persistence: serialize Garth session to DB (encrypted), load on subsequent syncs
- Key methods: `get_user_summary(date)`, `get_heart_rates(date)`, `get_sleep_data(date)`, `get_all_day_stress(date)`, `get_body_battery(start, end)`, `get_max_metrics(date)`, `get_activities_by_date(start, end)`
- MFA: library supports `return_on_mfa=True` for interactive code entry

### Encryption
- Garmin email/password encrypted with Fernet before DB storage (same as Telegram credentials)
- Token blobs encrypted similarly
- Decrypted only in memory during sync operations

### Sync Architecture
- APScheduler job per user (same pattern as Pulse polling)
- Job ID: `vitals_sync_{user_id}`
- On connect: immediate first sync + schedule periodic job
- On disconnect: remove scheduled job + optionally clear data
- Sync runs in background, updates `last_sync_at` and `sync_status` on GarminConnection

### AI Briefing Prompt Assembly
The briefing prompt includes structured data from multiple modules:
```
You are a personal wellness and productivity advisor.
Analyze the following data and provide a daily briefing.

## Health Data (Garmin)
- Sleep: {duration}h, score {score}/100, deep {deep}h, REM {rem}h
- Body Battery: {current}/{max}, charged {charged}, drained {drained}
- Resting HR: {resting_hr} bpm (7-day avg: {avg_7d})
- Stress: avg {avg_stress}, max {max_stress}
- Yesterday's activity: {activity_summary}

## Today's Schedule
- {n} meetings: {meeting_list}
- {n} task deadlines: {task_list}
- Free blocks: {free_blocks}

## Workload
- Active tasks: {active}, overdue: {overdue}
- Completion rate (7d): {rate}%

## Job Hunt
- Upcoming interviews: {interviews}
- Active applications: {active_apps}

Provide:
1. Health Status — brief assessment of physical readiness
2. Day Forecast — what the day looks like workload-wise
3. Recommendations — optimal timing for deep work, breaks, prep
4. Notable patterns — any correlations worth mentioning
```

### Data Retention
- Daily metrics: kept indefinitely (small data volume, ~1 row/day)
- Activities: kept indefinitely
- Briefings: kept for 90 days, older ones auto-cleaned
- Raw JSON fields allow future analysis without re-syncing

## Phases

### Phase 44: Vitals Backend — Connection & Data Models
- Add `garminconnect` + `garth` to requirements.txt
- Create DB models: GarminConnection, VitalsDailyMetric, VitalsSleep, VitalsActivity, VitalsBriefing
- Alembic migration for new tables
- Garmin auth service: connect, disconnect, token persistence, encryption
- Pydantic schemas for all models
- API endpoints: connect, disconnect, connection status
- Basic tests for auth flow and models

### Phase 45: Vitals Backend — Sync & Metrics Collection
- Garmin sync service: fetch daily metrics, sleep, activities from garminconnect API
- APScheduler integration: periodic sync job, manual sync trigger
- Upsert logic for daily metrics and activities
- API endpoints: metrics, sleep, activities, today, sync
- Dashboard vitals-summary endpoint
- Error handling, retry logic, sync status tracking
- Tests for sync service and API endpoints

### Phase 46: Vitals Backend — AI Daily Briefing
- Cross-module data assembly service (Garmin + Tasks + Calendar + Jobs)
- AI briefing generation with configurable LLM provider
- Briefing caching and regeneration logic
- API endpoints: briefing get, briefing generate
- Auto-generation after morning sync
- Briefing cleanup job (90-day retention)
- Tests for briefing generation and prompt assembly

### Phase 47: Vitals Frontend — Page & Charts
- Sidebar navigation entry for Vitals (Heart/Activity icon)
- `/vitals` page layout with Today's Summary + Briefing + Charts + Activities
- Today's Summary KPI cards (steps, HR, sleep, stress, Body Battery)
- AI Briefing card with markdown rendering and regenerate button
- Recharts: steps bar, HR line, sleep stacked bar, stress area, Body Battery range
- Period selector (7d / 30d / 90d)
- Activities list with type icons and filters
- React Query hooks for all vitals endpoints
- Empty state when Garmin not connected
- Frontend tests

### Phase 48: Vitals Frontend — Dashboard Widget, Settings & Demo
- Dashboard Vitals widget (Body Battery, steps, sleep, HR, stress)
- One-line AI insight in widget
- Settings → Garmin section (connect/disconnect, sync interval)
- Demo mode: seed script with 30 days of metrics + activities + briefing
- Demo restrictions (badges on sync, connect, AI generate)
- Update access matrix for demo user
- Frontend + backend tests for demo mode
