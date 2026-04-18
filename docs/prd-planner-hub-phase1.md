# PRD: Planner ↔ Personal Hub integration — Phase 1 (Backend foundation)

## Metadata

| Field | Value |
|-------|-------|
| Author | Dmitrii Vasichev |
| Date | 2026-04-17 |
| Status | Draft |
| Priority | P0 |
| Discovery | [discovery-2026-04-17-planner-hub-phase1.md](./discovery-2026-04-17-planner-hub-phase1.md) |

## Problem Statement

The Claude Code `/planner` skill writes daily plans as markdown files in a Drive-synced folder, while `my-personal-hub` Postgres owns the operational data (tasks, reminders, calendar, vitals). The two systems are disconnected: the planner does not see today's pending tasks or due reminders when building the plan, and the hub cannot display planning analytics because plan data is invisible to it.

Phase 1 establishes `my-personal-hub` Postgres as the single source of truth for daily plans, exposing a Planner API that downstream phases (skill port, Telegram bot, analytics UI) will consume. Markdown files in Drive become an optional human-readable rendering — generated from the DB, not the other way.

## User Scenarios

### Scenario 1: Morning planning query (consumed by skill in Phase 2)
**As** the `/planner` skill, **I want to** fetch today's pending tasks, due reminders, calendar events, and yesterday's adherence in one call, **so that** I can produce a realistic plan without the user re-entering that context.

### Scenario 2: Plan persistence
**As** the `/planner` skill (Phase 2) or `/dev`-initiated test (Phase 1), **I want to** POST a daily plan with ordered items, **so that** it becomes queryable, analysable, and visible to all clients.

### Scenario 3: Mark item done
**As** any client (skill, future Telegram bot, future UI), **I want to** PATCH a single plan item — update status, actual minutes, reschedule — **so that** completion state is tracked without re-uploading the whole plan.

### Scenario 4: Migrate historical plans
**As** the user, **I want to** run a one-shot script that seeds the DB from existing `*.md` daily plans in Drive, **so that** I do not lose historical adherence data and analytics work from day one.

### Scenario 5: Analytics aggregation (consumed by UI in Phase 4)
**As** the future analytics page, **I want to** fetch aggregates over a date range — adherence %, minutes by category, replans count — **so that** charts can be rendered without client-side aggregation.

## Functional Requirements

### P0 (Must Have)

#### Data model
- [ ] **FR-1:** `DailyPlan` entity with fields: `id` (PK), `user_id` (FK → users, indexed, CASCADE), `date` (Date, indexed), `available_minutes` (Int), `planned_minutes` (Int, default 0), `completed_minutes` (Int, default 0), `adherence_pct` (Float, nullable), `replans_count` (Int, default 0), `categories_actual` (JSON, default `{}`), `created_at`, `updated_at`. Unique constraint on `(user_id, date)`.
- [ ] **FR-2:** `PlanItem` entity with fields: `id` (PK), `plan_id` (FK → daily_plans, CASCADE), `order` (Int), `title` (String), `category` (String, nullable), `minutes_planned` (Int), `minutes_actual` (Int, nullable), `status` (enum: `pending`, `in_progress`, `done`, `skipped`, `rescheduled`), `linked_task_id` (FK → tasks, nullable, SET NULL on delete), `notes` (Text, nullable), `created_at`, `updated_at`.
- [ ] **FR-3:** Alembic migration generated via autogenerate; both tables + FKs + indexes + enum type.

#### API endpoints
- [ ] **FR-4:** `GET /api/planner/context?date=YYYY-MM-DD` — returns `{pending_tasks, due_reminders, calendar_events, yesterday_adherence}`. Scoped to `current_user`. Date defaults to today in user's timezone.
- [ ] **FR-5:** `POST /api/planner/plans` — upsert. Body: `{date, available_minutes, items: [{order, title, category, minutes_planned, linked_task_id?}, ...]}`. If plan for that date exists, replace items and increment `replans_count`. Returns full plan with IDs.
- [ ] **FR-6:** `GET /api/planner/plans/{date}` — returns plan with items ordered by `order`. 404 if not found.
- [ ] **FR-7:** `PATCH /api/planner/plans/{date}/items/{item_id}` — partial update on a single item: `status`, `minutes_actual`, `notes`, optionally `title/category/minutes_planned` for reschedule. Recomputes parent plan's `completed_minutes` and `adherence_pct` on save.

#### Analytics
- [ ] **FR-8:** `GET /api/planner/analytics?from=YYYY-MM-DD&to=YYYY-MM-DD` — returns: total days planned, average adherence, minutes by category (summed), streak of consecutive on-track days (adherence ≥ 0.7), replans count, daily series for charting.

#### Auth & permissions
- [ ] **FR-9:** All endpoints require JWT (`Depends(get_current_user)`). Plans are user-scoped — user can only access their own plans. No admin override for Phase 1 (not needed, not useful).
- [ ] **FR-10:** Demo users can read (their seeded demo plans) but writes blocked via `restrict_demo` dependency, matching existing task/reminder pattern.

#### Timezone consolidation (prerequisite)
- [ ] **FR-11:** Add `timezone` column to `users` table — `String(64), NOT NULL, server_default='UTC'`. Backfill migration copies `pulse_settings.timezone` → `users.timezone` for each existing user; users without pulse settings get `'UTC'`.
- [ ] **FR-12:** Remove `timezone` from `PulseSettings` (column dropped in the same migration). All code paths that currently read `pulse_settings.timezone` updated to read `user.timezone`. `PulseSettings` remains for its other fields.
- [ ] **FR-13:** User profile API (`PATCH /api/users/me` or existing equivalent) validates `timezone` against IANA timezone list (`zoneinfo.available_timezones()`). Rejects invalid values with 400.
- [ ] **FR-14:** Planner API and all other timezone-dependent code reads `user.timezone` directly — no fallback logic needed since field is NOT NULL.

#### Security pre-provisioning for Phase 3
- [ ] **FR-15a:** Add `telegram_pin_hash` column to `users` table — `String(255), nullable`. Null means no PIN set; non-null is bcrypt/argon2 hash. Not used in Phase 1, but the column exists so Phase 3 does not need another migration.
- [ ] **FR-15b:** Add `telegram_user_id` column to `users` table — `BigInteger, nullable, unique`. Used to whitelist which Telegram account can talk to the bot. Not enforced in Phase 1 (no bot yet), but reserves the field.

#### Migration script
- [ ] **FR-16:** `backend/scripts/migrate_drive_plans_to_db.py` — reads `~/Documents/Notes/Planner/daily-plans/*.md`, parses frontmatter + item list, upserts `DailyPlan` + `PlanItem`. Idempotent (re-runnable). CLI args: `--user-id`, `--dry-run`, `--source-dir`. Logs summary (created, updated, skipped, errors). Must handle missing/malformed files gracefully.

### P1 (Should Have)

- [ ] ~~**FR-17:** Optional Drive markdown rendering side-effect. On POST/PATCH, if feature flag `PLANNER_DRIVE_RENDER_ENABLED=true`, regenerate the `*.md` file in Drive to match DB state. Reuses existing `app/services/google_drive.py`. Failure to render does not block the API response — logs error and continues.~~ **Deferred to Phase 2** — the render target path is on the local filesystem, which is a no-op on Railway (backend host). Revisit when the /planner skill moves to HTTP in Phase 2.
- [ ] **FR-18:** `category_planned` aggregation on plan save — computed from items and stored on the plan as JSON `{"career": 120, "english": 60, ...}` for fast analytics queries.
- [ ] **FR-19:** Frontend Settings page — move timezone selector from Pulse section to general Profile section. UI change only, backend is source-of-truth agnostic.

### P2 (deferred — not part of this phase)

- Skill-side port to HTTP → Phase 2
- Telegram bot + voice → Phase 3
- Frontend analytics UI → Phase 4

## Non-Functional Requirements

- **Performance:** `GET /context` must return < 300ms p95 for users with up to 200 active tasks + 50 due reminders. Use `selectinload()` for eager loads where needed.
- **Consistency:** `(user_id, date)` uniqueness on `DailyPlan` enforced at DB level — no two plans for the same day per user. POST is upsert, never creates duplicates.
- **Atomicity:** POST replacing items is a single transaction — either all items replaced or none.
- **Migration safety:** `migrate_drive_plans_to_db.py` dry-run mode shows what would be created/updated without writing.
- **Observability:** Standard logging via existing logger; no new metrics/tracing required in this phase.

## Technical Design

### Stack (existing, unchanged)
- FastAPI + SQLAlchemy async + PostgreSQL + Alembic + Pydantic v2
- Routes follow existing `app/api/reminders.py` pattern (prefix, tags, `Depends(get_db)`, `Depends(get_current_user)`)
- Services are async functions in `app/services/planner.py`, not class-based (matches `app/services/task.py`)

### Data model

```
daily_plans
  id              PK
  user_id         FK(users) CASCADE, indexed
  date            Date, indexed
  available_minutes  Int
  planned_minutes    Int default 0
  completed_minutes  Int default 0
  adherence_pct      Float nullable
  replans_count      Int default 0
  categories_planned JSON default '{}'     # from P1
  categories_actual  JSON default '{}'
  created_at, updated_at
  UNIQUE(user_id, date)

plan_items
  id              PK
  plan_id         FK(daily_plans) CASCADE, indexed
  order           Int
  title           String(500)
  category        String(100) nullable
  minutes_planned Int
  minutes_actual  Int nullable
  status          Enum(pending, in_progress, done, skipped, rescheduled)
  linked_task_id  FK(tasks) SET NULL, nullable
  notes           Text nullable
  created_at, updated_at
```

### Enum
```python
class PlanItemStatus(str, enum.Enum):
    pending = "pending"
    in_progress = "in_progress"
    done = "done"
    skipped = "skipped"
    rescheduled = "rescheduled"
```

### API shapes (Pydantic)

```
PlanItemCreate:      order, title, category?, minutes_planned, linked_task_id?, notes?
PlanItemUpdate:      title?, category?, minutes_planned?, minutes_actual?, status?, notes?
PlanItemResponse:    all fields + task_title (derived)

DailyPlanCreate:     date, available_minutes, items: [PlanItemCreate]
DailyPlanResponse:   all fields + items: [PlanItemResponse]

PlannerContextResponse:
  date, timezone
  pending_tasks:     [{id, title, priority, deadline, category}]
  due_reminders:     [{id, title, remind_at, is_urgent, task_id?}]
  calendar_events:   [{id, title, start, end}]
  yesterday:         {adherence_pct, completed_minutes, replans_count} | null

AnalyticsResponse:
  from, to, days_count
  avg_adherence, total_planned_minutes, total_completed_minutes
  minutes_by_category: {career: 480, english: 240, ...}
  longest_streak: int
  replans_total: int
  daily_series: [{date, adherence, planned, completed, replans}]
```

### File layout
```
backend/app/models/daily_plan.py       # DailyPlan + PlanItem + PlanItemStatus enum
backend/app/models/user.py             # MODIFIED: add timezone, telegram_pin_hash, telegram_user_id columns
backend/app/models/telegram.py         # MODIFIED: drop timezone from PulseSettings
backend/app/schemas/planner.py         # All Pydantic schemas
backend/app/schemas/user.py            # MODIFIED: add timezone to UserCreate/Update/Response (PIN fields are admin-only, not in public schema)
backend/app/api/planner.py             # Router with 5 endpoints (context, POST plans, GET plan, PATCH item, analytics)
backend/app/services/planner.py        # Async functions
backend/alembic/versions/<ts>_consolidate_user_timezone_and_reserve_tg.py  # User field changes
backend/alembic/versions/<ts+1>_add_daily_plans.py                         # Daily plans table
backend/scripts/migrate_drive_plans_to_db.py
backend/tests/test_planner.py          # Integration tests
backend/tests/test_user_timezone.py    # Tests for timezone consolidation
```

### Recomputation logic on PATCH
When `status` transitions to `done`/`skipped` or `minutes_actual` changes:
1. Recompute `plan.completed_minutes` = sum of `minutes_actual` where status='done'.
2. Recompute `plan.adherence_pct` = `completed_minutes / planned_minutes` (0 if `planned_minutes == 0`).
3. Recompute `plan.categories_actual` = group by `category`, sum `minutes_actual` where status='done'.

All in the same transaction as the item update.

### Migration script approach
1. Read `~/Documents/Notes/Planner/daily-plans/*.md` from local filesystem (script runs where files are synced; not via Drive API — simpler, deterministic).
2. Parse frontmatter (YAML) → top-level fields.
3. Parse body sections (`## Tasks`, `## Reminders`, etc.) → `PlanItem` rows. Since existing markdown format is informal, a best-effort parser with per-line fallback; unparseable content goes into `notes` field of a single catch-all item.
4. Upsert via ORM with `ON CONFLICT(user_id, date)` equivalent — check existence by `(user_id, date)`, update or insert.
5. Summary printed at end: `Created: N, Updated: M, Skipped: K, Errors: E (see log)`.

## Security posture for downstream phases

This section documents the security model for the Telegram bot (Phase 3) and other remote-control surfaces. **Nothing here is implemented in Phase 1** beyond reserving the DB columns (FR-15a, FR-15b). The goal is to make Phase 3 design decisions explicit now, while the architecture is fresh.

### Threat model

Primary threat: **physical access to an unlocked iPhone** → adversary uses the Telegram bot to exfiltrate data (personal files, credentials) or cause destructive operations (delete files, push to main, overwrite notes). Not covered: remote network attacks (Telegram Bot API already isolates the bot behind Telegram's infrastructure; `telegram_user_id` whitelist blocks unauthorized senders at the first layer).

### Layered defense (for Phase 3 implementation)

**Layer 1 — Access gate.** Bot accepts messages only from whitelisted `telegram_user_id` (field reserved in Phase 1). Any other sender: silent drop.

**Layer 2 — PIN.** First message per session (or after N minutes idle) requires a PIN. Stored as hash in `users.telegram_pin_hash` (field reserved in Phase 1). No PIN = no commands.

**Layer 3 — Telegram app lock.** Face ID on the Telegram iOS app itself — configured by user outside this codebase. Documented as part of Phase 3 setup guide.

**Layer 4 — Command allowlist with intent classification.** All messages flow through a classifier before reaching `claude -p`. Three tiers:

| Tier | Examples | Confirmation |
|---|---|---|
| **Safe** | `/today`, `/status`, `/done`, `/snooze`, `/list`, planning queries, English lessons | None |
| **Edit** | `/dev tweak`, `/dev bug`, task edits, any write operation | Inline "Confirm Yes/No" |
| **Danger** | git push to main, file deletion, exfiltration (sending local files to Telegram), access to `~/Documents/Notes/Personal/**`, shell commands outside safe list | Blocked by default; requires PIN + explicit `unlock danger 10m` |

Classifier can be a lightweight rule-based check with an LLM fallback (e.g., a narrow `claude -p` invocation with a classification prompt).

**Layer 5 — Claude Code deny lists.** A dedicated `settings.json` profile for Telegram-invoked sessions restricts tool access at the runtime level — second containment line regardless of classifier errors:

```
deny Bash:
  rm *, mv * /tmp, git push * main, git push --force,
  curl/wget to unknown domains, any pipe to /tmp
deny Write/Edit:
  ~/.ssh/*, ~/Documents/Notes/Personal/*, ~/.aws/*, ~/.config/gh/*
deny Read:
  ~/.ssh/*, ~/Documents/Notes/Personal/*
deny custom:
  upload file to Telegram Bot API (bot code controls what it sends)
```

**Layer 6 — Audit & kill switch.**
- Every bot command logged to `telegram_audit_log` table (schema defined in Phase 3).
- Kill switch 1: revoke bot token via @BotFather (requires Telegram 2FA on your account).
- Kill switch 2: env flag `EMERGENCY_STOP=true` checked on every bot tick — set via SSH to Mac.

### What this means for Phase 1

Only the DB schema pre-provisioning lands now:
- `users.telegram_pin_hash` — nullable, hash storage for PIN (Phase 3 populates it)
- `users.telegram_user_id` — nullable, unique, whitelist field

No API, no enforcement, no bot code. This avoids a schema migration in Phase 3 when we actually wire up the bot.

### Explicit non-goals of this security model

- Not a defense against a compromised Mac itself (bot runs on Mac, so `claude -p` has same access Mac's user has). If the Mac is physically compromised, attacker has filesystem access regardless of the bot.
- Not a defense against Anthropic API compromise or Claude prompt-injection vulnerabilities at the model level. Assumes Claude respects the deny lists in `settings.json`.
- Not cryptographic end-to-end secrecy between phone and Mac. Telegram stores messages on their servers (2-hour retention for voice, longer for text). If that's unacceptable, Telegram Mini App with local-only delivery is a Phase 3+ consideration.

## Out of Scope

- Moving the `/planner` skill itself to use the new API (Phase 2).
- Telegram bot, voice input, context management (Phase 3).
- Frontend analytics pages / charts (Phase 4).
- `DELETE /api/planner/plans/{date}` endpoint — POST is full-replace, a dedicated delete is not needed.
- Real-time subscription/websockets for plan changes — polling is fine for MVP.
- Shared/team plans — single-user-per-plan only.
- Plan templates or recurring plans — not needed for Phase 1.
- Garmin/Vitals integration in `GET /context` — interesting but out of scope.
- Pytest test-database fixture — tests follow existing pattern (hit dev DB or mock at service level). A proper fixture is a separate `/dev chore` if desired later.

## Acceptance Criteria

- [ ] **AC-1:** `alembic upgrade head` applies both migrations cleanly on a fresh DB; `alembic downgrade -2` reverts cleanly.
- [ ] **AC-2:** After the user-fields migration, `users.timezone` is populated for all existing users (backfilled from PulseSettings where available, `'UTC'` otherwise); `pulse_settings.timezone` column is gone; Pulse features (digest scheduling, birthday reminders) still work, now reading from `user.timezone`. Additionally, `users.telegram_pin_hash` and `users.telegram_user_id` columns exist as nullable (reserved for Phase 3) and are visible in the ORM schema but not exposed through any public API endpoint.
- [ ] **AC-3:** Creating a plan via `POST /api/planner/plans` with 5 items persists all items in order; `GET /api/planner/plans/{date}` returns them with correct linked task titles.
- [ ] **AC-4:** `PATCH /api/planner/plans/{date}/items/{id}` with `status=done, minutes_actual=55` updates the item AND parent plan's `completed_minutes`, `adherence_pct`, `categories_actual` atomically.
- [ ] **AC-5:** `POST` a second plan for the same date increments `replans_count` and replaces items.
- [ ] **AC-6:** `GET /api/planner/context` returns structurally correct payload with pending tasks, due reminders, calendar events, and yesterday's adherence (null if no plan existed yesterday); "today" is resolved using `user.timezone`.
- [ ] **AC-7:** `GET /api/planner/analytics?from=X&to=Y` returns correct aggregates for a seeded dataset of 7+ days.
- [ ] **AC-8:** Demo user gets 403 on POST/PATCH; gets 200 on GET.
- [ ] **AC-9:** Another user's plan is not accessible — 404 when querying someone else's date.
- [ ] **AC-10:** `PATCH /api/users/me` with invalid timezone (e.g. `"Foo/Bar"`) returns 400; with valid IANA timezone (`"Europe/Berlin"`) returns 200 and persists.
- [ ] **AC-11:** `migrate_drive_plans_to_db.py --dry-run` reports intended changes without writing; a real run seeds DB from all `*.md` files, re-runs are idempotent.
- [ ] **AC-12:** All existing tests continue to pass; new tests cover happy path for each endpoint + migration script + timezone consolidation.

## Risks & Open Questions

1. **Informal markdown format in daily-plans.** Existing files have varying structure — frontmatter is reliable, but items are free-form markdown lists. Migration parser will be best-effort; if a date cannot be parsed, it's logged and skipped rather than failing the whole run. User should manually review after first dry-run.

2. **`linked_task_id` cleanup.** If a task is deleted, existing plan items point to a stale FK. `SET NULL` chosen over CASCADE — preserves historical plan items even if the underlying task is gone. The `task_title` field in response is looked up live; after a task is deleted, it returns `null`.

3. **Replans semantics.** POST replaces items entirely. If user wants to preserve in-progress item completion state across replans, they must PATCH individual items rather than re-POST the whole plan. Decision: keep POST as full-replace for Phase 1; if this hurts, add a merge strategy in Phase 2.

4. **Timezone consolidation rollback.** Dropping `pulse_settings.timezone` is a destructive migration. If something depends on it that we missed, rollback means restoring column + re-populating. Mitigation: before running migration, grep the entire codebase for `pulse_settings.timezone` / `PulseSettings.timezone` references and update them all in the same PR. Downgrade step in alembic explicitly restores the column and copies values back.

5. **Drive render failure mode.** Side-effect Drive render (P1) must not block the API response. Errors logged, API returns 200. Acceptable for Phase 1; if Drive diverges noticeably, user can re-run migration script to re-sync from DB.

6. **Test DB availability.** Backend currently has no test DB fixture (per explore report). Phase 1 tests will follow the existing pattern (hit the real dev DB or mock at service level). Proper test fixture is a separate `/dev chore` if desired later.
