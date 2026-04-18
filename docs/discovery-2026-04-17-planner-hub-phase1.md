# Discovery: Planner ↔ Personal Hub integration (Phase 1)

**Date:** 2026-04-17
**Mode:** Condensed snapshot (from architecture conversation, not structured interview)

## Problem

The user runs a Claude Code `/planner` skill that generates daily plans and writes them as markdown files in a Google Drive-synced folder (`~/Documents/Notes/Planner/daily-plans/YYYY-MM-DD.md`). Separately, the `my-personal-hub` backend owns operational data — tasks, reminders, calendar events, vitals. The two systems do not talk to each other:

- The planner does not know about pending tasks or due reminders when building the daily plan — the user must mention them verbally each morning.
- Completion data (what was actually done, in how many minutes) lives only in markdown frontmatter and is invisible to the hub's analytics.
- The hub cannot render any planning dashboard because it has no access to plan data.

The larger initiative this phase belongs to will also bring Telegram-based control and voice input, but those are separate phases.

## Goal of Phase 1

Make `my-personal-hub` Postgres the **single source of truth for daily plans**, and expose a Planner API that future phases (the skill itself, Telegram bot, analytics UI) will consume.

## Scope (Phase 1 only)

1. New entities in Postgres: `DailyPlan` (one per user per date) + `PlanItem` (ordered items within a plan).
2. `PlanItem.linked_task_id` as optional FK to the existing `Task` model — reuse, do not duplicate.
3. Planner API: `GET /api/planner/context`, `POST /api/planner/plans`, `PATCH /api/planner/plans/{date}/items/{id}`, `GET /api/planner/plans/{date}`, `GET /api/planner/analytics`.
4. One-shot, idempotent migration script that reads existing `*.md` files from Drive-synced folder and seeds the DB.
5. Optional Drive markdown rendering as a side-effect on save — behind a feature flag, disabled by default.

## Out of scope (future phases)

- **Phase 2:** Porting the `/planner` skill off Drive-markdown onto the new HTTP API.
- **Phase 3:** Telegram bot with `claude -p` subprocess, voice via local Whisper, named contexts.
- **Phase 4:** Frontend analytics page (completion charts, streaks, minutes-by-category).

## Key architectural decisions (already agreed)

| Decision | Rationale |
|---|---|
| Postgres = source of truth for plans | Enables API access, cross-device sync, analytics, Telegram queries |
| Markdown in Drive = optional human-readable side-effect | Keeps Obsidian/Drive viewer workflow if user wants it; can be disabled later |
| `~/Documents/Notes/Personal/` stays as source of truth for personal reference data (car, visa, docs) | CLAUDE.md already codifies this; files are portable, no analytics need |
| `PlanItem` links to `Task` via FK, does not duplicate task title/status | One-way truth: task state in `tasks`, plan state (scheduled minutes, actuals) in `plan_items` |
| Multi-tenant via `user_id` FK on both entities | Matches existing patterns (`tasks`, `reminders`) |
| Bot, voice, context-management are separate phases | Keeps Phase 1 focused on the data foundation |

## Non-architectural agreements

- Mac stays on at home via Amphetamine (trigger: while power adapter connected). MacBook remains primary device; Mac mini considered if usage validates it after 1–2 months.
- Future Telegram bot will use `claude -p --session-id=<name>` to reuse the Claude Pro/Max subscription — not the Anthropic API.
- Local Whisper (`faster-whisper`) for voice transcription.

## Open questions deferred to Phase 2/3

- Exact shape of `PATCH item` payload when skill replans a day mid-stream (separate `POST /plans` vs. incremental `PATCH`?).
- Whether Drive markdown rendering should be per-user-opt-in (setting) or global feature flag (env var).
- Timezone handling for "today" — derived from `user.settings.timezone` or always UTC? (Existing `PulseSettings.timezone` likely the right source.)

These are for the PRD to resolve.
