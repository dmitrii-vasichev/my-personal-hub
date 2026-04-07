# PRD: Reminders Module

## Metadata
| Field | Value |
|-------|-------|
| Author | Dmitrii Vasichev |
| Date | 2026-04-06 |
| Status | Draft |
| Priority | P0 |

## Problem Statement

Daily-use reminder app (one-time reminders, recurring reminders, birthdays) lives as a
separate mobile app, disconnected from Personal Hub. The user wants to consolidate into
Hub while keeping the same convenience: fast creation, persistent push notifications
until acknowledged, and snooze/done actions from the phone.

Additionally, the current task reminder system (`reminder_at` field on Task) is a
separate notification pipeline. This creates confusion: reminders live in two places
with different UX and different logic. The new Reminders module becomes the **single
unified notification layer** — both standalone reminders and task-linked reminders flow
through the same model and notification pipeline.

## User Scenarios

### Scenario 1: Quick reminder creation
**As a** user, **I want to** open the Reminders page, tap "+", pick date/time via scroll
picker, type the title and save — **so that** I can create a reminder in under 10 seconds.

### Scenario 2: Get notified and react
**As a** user, **I want to** receive a Telegram push when the reminder fires, with inline
buttons (Snooze 15 min / Snooze 1 hour / Done) — **so that** I can react without opening
the app.

### Scenario 3: Persistent nagging
**As a** user, **I want** the bot to keep sending me notifications every N minutes (up to
M times) until I react — **so that** I don't miss important reminders.

### Scenario 4: Recurring reminder
**As a** user, **I want to** set a reminder that repeats (daily/weekly/monthly/yearly) —
**so that** recurring tasks like "pay rent on the 30th" fire automatically every month.

### Scenario 5: Birthday tracking
**As a** user, **I want to** store birthdays with advance notice (e.g. 3 days before) —
**so that** I get a reminder before each birthday and never forget to congratulate someone.

### Scenario 6: Browse upcoming reminders
**As a** user, **I want to** see all my upcoming reminders grouped by date (Today,
Tomorrow, specific dates) — **so that** I have a clear picture of what's coming.

### Scenario 7: Task-linked reminder
**As a** user, **I want to** set a reminder on a task and see it in the Reminders list
alongside standalone reminders — **so that** all my reminders are in one place with
unified snooze/done/notification behavior.

## Functional Requirements

### P0 (Must Have)

- [ ] FR-1: Unified `Reminder` model — title, remind_at, status (pending/done),
  snoozed_until, recurrence_rule, snooze_count, optional task_id FK.
  Serves as the single notification layer for both standalone and task-linked reminders
- [ ] FR-2: CRUD API — create, list (grouped by date), update, delete, mark done, snooze
- [ ] FR-3: Web UI — `/reminders` page with date-grouped list, quick-add form
  (title + date/time picker)
- [ ] FR-4: Telegram notifications — send message with inline buttons
  [Snooze 15 min] [Snooze 1 hr] [Done] when reminder fires; hardcoded buttons
  (for full reschedule → open Hub via web UI)
- [ ] FR-5: Telegram callback handler — webhook endpoint to process inline button presses
- [ ] FR-6: Repeating notifications — scheduler sends up to N notifications every M minutes
  until user reacts (default: 5 repeats / 5 min interval)
- [ ] FR-6a: Notification settings — user can configure repeat count and interval
  (stored in PulseSettings; UI in existing Settings page, "Reminders" section)
- [ ] FR-7: Recurring reminders — support daily, weekly, monthly, yearly recurrence;
  on "done", auto-advance remind_at to next occurrence
- [ ] FR-8: `Birthday` model — name, birth_date, advance_days, reminder_time;
  scheduler auto-generates reminder N days before each birthday
- [ ] FR-9: Birthdays UI — `/reminders/birthdays` page, add/edit/delete birthdays
- [ ] FR-10: Sidebar navigation — add "Reminders" item with Bell icon
- [ ] FR-11: Snooze counter + visual escalation — track `snooze_count` per reminder;
  UI badges: grey (1-2), orange (3-4), red (5+); Telegram messages show count:
  "🔴 (snoozed 5x) Title"
- [ ] FR-12: Anti-procrastination gate — after N snoozes (configurable, default 5),
  remove quick-snooze buttons from Telegram; only "Done" and "Open in Hub" remain;
  forces conscious reschedule via web UI instead of lazy snooze
- [ ] FR-13: Task reminder integration — setting reminder_at on a Task creates/updates
  a linked Reminder (task_id FK); task detail UI uses Reminder API under the hood
- [ ] FR-14: Migration — convert existing task reminder fields (reminder_at,
  reminder_dismissed, reminder_telegram_sent) to Reminder records; deprecate old fields
- [ ] FR-15: Unified notification pipeline — remove old task_reminders scheduler job;
  all notifications (standalone + task-linked) go through single Reminder scheduler
- [ ] FR-16: Reminders list shows source badge — standalone reminders show no badge;
  task-linked reminders show "Task" badge with link to task detail page

### P1 (Should Have)

- [ ] FR-17: Telegram Mini App — bot menu button opens `/reminders` with auto-auth
  via Telegram initData (no login/password)
- [ ] FR-18: PWA manifest — allow adding `/reminders` as home screen shortcut

### P2 (Nice to Have)

- [ ] FR-19: Per-reminder notification overrides — allow individual reminders to have
  custom repeat count/interval different from global defaults

## Non-Functional Requirements

- **Latency:** Telegram notification must fire within 2 minutes of remind_at
- **Reliability:** Missed scheduler runs must be handled (misfire_grace_time)
- **Timezone:** All times displayed in user's timezone (from PulseSettings.timezone)
- **Security:** Telegram webhook verified via bot token secret; user isolation via user_id

## Technical Design

### Data Model

```
reminders
├── id: int PK
├── user_id: int FK(users) NOT NULL
├── title: str NOT NULL
├── remind_at: datetime(tz) NOT NULL
├── status: enum(pending, done) DEFAULT pending
├── snoozed_until: datetime(tz) NULL
├── recurrence_rule: str NULL  — "daily" | "weekly" | "monthly" | "yearly"
├── snooze_count: int DEFAULT 0              — total snoozes (for anti-procrastination)
├── notification_sent_count: int DEFAULT 0   — repeats within current firing cycle
├── telegram_message_id: int NULL            — to track sent message
├── task_id: int FK(tasks) NULL              — optional link
├── created_at: datetime(tz)
└── updated_at: datetime(tz)

birthdays
├── id: int PK
├── user_id: int FK(users) NOT NULL
├── name: str NOT NULL
├── birth_date: date NOT NULL
├── advance_days: int DEFAULT 3
├── reminder_time: time DEFAULT 10:00
├── created_at: datetime(tz)
└── updated_at: datetime(tz)

pulse_settings (existing table — add columns)
├── reminder_repeat_count: int DEFAULT 5       — how many times to nag
├── reminder_repeat_interval: int DEFAULT 5    — minutes between nags
├── reminder_snooze_limit: int DEFAULT 5       — snoozes before quick-snooze is disabled
├── birthday_advance_days: int DEFAULT 3       — days before birthday to remind
└── birthday_reminder_time: time DEFAULT 10:00 — time of birthday reminder
```

### API Endpoints

```
# Reminders
GET    /api/reminders              — list upcoming, grouped by date
POST   /api/reminders              — create
PATCH  /api/reminders/{id}         — update
DELETE /api/reminders/{id}         — delete
POST   /api/reminders/{id}/done    — mark done (advance if recurring)
POST   /api/reminders/{id}/snooze  — snooze (body: { minutes: 15|60 })

# Birthdays
GET    /api/reminders/birthdays         — list all
POST   /api/reminders/birthdays         — create
PATCH  /api/reminders/birthdays/{id}    — update
DELETE /api/reminders/birthdays/{id}    — delete

# Telegram webhook
POST   /api/telegram/reminder-callback  — handle inline button presses
```

### Notification Flow

```
Scheduler (every 2 min)
  │
  ├─ Find reminders: remind_at <= now
  │   AND status = pending
  │   AND (snoozed_until IS NULL OR snoozed_until <= now)
  │   AND notification_sent_count < max_notifications (from settings)
  │
  ├─ For each: send Telegram message with inline buttons
  │   ├─ If snooze_count < snooze_limit:
  │   │   ├─ [Snooze 15 min]  →  callback: snooze_15_{id}
  │   │   ├─ [Snooze 1 hour]  →  callback: snooze_60_{id}
  │   │   └─ [Done]           →  callback: done_{id}
  │   ├─ If snooze_count >= snooze_limit (anti-procrastination gate):
  │   │   ├─ [Done]           →  callback: done_{id}
  │   │   └─ [Open in Hub]   →  URL button to /reminders/{id}
  │   │   (message includes: "⚠️ Snoozed {N} times. Quick snooze disabled.")
  │   ├─ Message prefix by snooze_count:
  │   │   ├─ 0-2: "🔔 Reminder: {title}"
  │   │   ├─ 3-4: "🟠 (snoozed {N}x) {title}"
  │   │   └─ 5+:  "🔴 (snoozed {N}x) {title}"
  │
  └─ Increment notification_sent_count

User taps button in Telegram
  │
  ├─ "Done" → mark done; if recurring → advance remind_at, reset snooze_count & sent_count
  ├─ "Snooze 15 min" → set snoozed_until = now + 15min, reset sent_count, snooze_count++
  ├─ "Snooze 1 hour" → set snoozed_until = now + 60min, reset sent_count, snooze_count++
  └─ "Open in Hub" → URL button, user reschedules manually in web UI
```

### Recurring Logic

On "done" for recurring reminder:
- `daily` → remind_at += 1 day
- `weekly` → remind_at += 7 days
- `monthly` → remind_at += 1 month (dateutil.relativedelta)
- `yearly` → remind_at += 1 year

Status stays `pending`, notification_sent_count resets to 0.

### Birthday → Reminder Generation

Daily scheduler job (e.g. at 01:00 user's local time):
1. Find birthdays where `birth_date` (month+day) is within `advance_days` from today
2. Check if a reminder for this birthday already exists this year
3. If not — create a one-time Reminder: "🎂 {name}" at birthday minus advance_days, reminder_time

### Stack

- Backend: FastAPI + SQLAlchemy async + APScheduler (existing stack)
- Frontend: Next.js + React Query + shadcn (existing stack)
- Telegram: python-telegram-bot (existing library), inline keyboards, webhook
- No new dependencies required

## Implementation Phases

### Phase 1: Core Reminders + Telegram (foundation)
FR-1, FR-2, FR-3, FR-4, FR-5, FR-6, FR-6a, FR-10, FR-11, FR-12, FR-13, FR-14, FR-15, FR-16

Deliverables:
- Reminder model (with snooze_count, task_id FK) + migration
- Data migration: existing task reminders → Reminder records
- CRUD API endpoints
- Unified scheduler job (replaces old task_reminders job)
- Telegram webhook for inline button callbacks
- Snooze counter + visual escalation (UI badges + Telegram message prefix)
- Anti-procrastination gate (disable quick-snooze after N snoozes)
- Web UI: list page + quick-add form (with source badges for task-linked)
- Task detail UI refactored to use Reminder API
- Notification settings in Settings page (repeat count, interval, snooze limit)
- Sidebar nav item
- Remove deprecated task reminder fields + old notification service

### Phase 2: Recurring + Birthdays
FR-7, FR-8, FR-9

Deliverables:
- Recurrence logic (advance on done)
- Recurring UI (picker in create/edit form)
- Birthday model + migration
- Birthday CRUD API
- Birthday UI page
- Daily birthday → reminder generation job

### Phase 3: Mobile Access (P1)
FR-17, FR-18

Deliverables:
- Telegram Mini App auth endpoint
- Bot menu button configuration
- PWA manifest + service worker

## Out of Scope

- Calendar view (Google Calendar integration exists separately)
- Telegram text commands for creating reminders (e.g. `/remind 18:00 ...`)
- Email notifications
- Shared/collaborative reminders
- Location-based reminders
- File attachments on reminders

## Acceptance Criteria

- [ ] AC-1: User can create a reminder in under 10 seconds via web UI
- [ ] AC-2: Telegram notification fires within 2 minutes of remind_at
- [ ] AC-3: Inline buttons in Telegram correctly snooze/complete reminders
- [ ] AC-4: Repeating notifications stop after N sends or user reaction
- [ ] AC-5: Recurring reminder auto-advances to next occurrence on "done"
- [ ] AC-6: Birthday reminder fires N days before birthday at configured time
- [ ] AC-7: All times display in user's local timezone
- [ ] AC-8: Task-linked reminders appear in /reminders list with "Task" badge
- [ ] AC-9: Setting reminder on task creates a Reminder record (not old field)
- [ ] AC-10: Old task reminder fields removed; single notification pipeline
- [ ] AC-11: Snooze counter visible in UI (badge) and Telegram (message prefix)
- [ ] AC-12: Quick-snooze buttons disabled after N snoozes in Telegram

## Risks & Open Questions

- **Telegram webhook setup:** Requires HTTPS public URL. Railway backend already has
  this, but webhook registration needs to happen on app startup or via settings.
  Need to verify current bot setup supports webhooks alongside direct sends.
- **Scheduler reliability:** If backend restarts during notification window, some
  notifications may be delayed. APScheduler's misfire_grace_time handles this.
- **Month-end edge case:** Monthly recurrence on Jan 31 → Feb 28 or Mar 31?
  Use dateutil.relativedelta which handles this correctly.
- **Task reminder migration:** Existing tasks with `reminder_at` must be migrated to
  Reminder records. The old task reminder API endpoints (`/api/tasks/reminders/due`,
  `/api/tasks/{id}/reminders/dismiss`) and frontend hooks (`use-task-reminders.ts`,
  `reminder-poller.tsx`) must be replaced. Risk of breaking existing task reminder
  behavior during transition — mitigate with data migration in same deploy.
