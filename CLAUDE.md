# My Personal Hub

## Stack
- Frontend: Next.js 16, React 19, TypeScript, Tailwind 4, shadcn, Recharts
- Backend: FastAPI, SQLAlchemy (async), PostgreSQL, Alembic
- Deploy: Vercel (frontend), Railway (backend)
- AI: OpenAI, Anthropic, Google Generative AI
- Integrations: Telegram (Telethon + Bot API), Garmin Connect, Google Calendar, Google Drive, Gmail

## Current Status

**Mode:** D13 `job<->calendar linking` shipped on `main` (squash `e2a8c42`, docs `dde22be`, 2026-04-22, pushed to `origin/main`). Nullable `calendar_events.job_id` FK + substring-match hint endpoint + JobLinkSelector in the edit dialog + Hero cell #2 reads "Interviews this week". One-shot backfill script at `backend/scripts/backfill_job_event_links.py`. Zero ship-blocking regressions. See `docs/archive/shipped-log.md` for the full D13 outcome summary.

**Post-ship smoke items deferred (not blockers):** AC-12 Hero-cell live render; AC-13 dialog round-trip; AC-14 create-mode has no selector; cross-user attempted link via dev-tools PATCH; PROD backfill rehearsal against a prod snapshot.

## Next queued work

All items below require their own PRD / decision before build.

**D. Planner/Today feature gaps:**
- **D14. `linked_document_id` on Task** — unblocks `JUMP TO DRAFT` in `hero-priority.tsx`. Nullable column on `tasks`, UI for linking a note, conditional button when link present.
- **D15. Per-item `read` flag on pulse items** — unblocks "Pulse unread" Hero cell (currently "Meetings today"). Column on `pulse_items`, `PATCH /pulse/items/{id}/read`, frontend `markAsRead`, `hero-cells.tsx` counter.

## Load-bearing constraints (still in force)

- **Telegram scope:** keep Pulse, reminder callbacks, and Telegram Mini App behavior separate from the decommissioned Telegram-to-Claude-Code bridge. The bridge bot and its local `telegram_bot/` runtime are no longer active project surfaces.

## Shipped history

Full outcome summaries for every closed initiative live in **`docs/archive/shipped-log.md`**. Most recent entries:

- **D13** `job<->calendar linking` — squash `e2a8c42` (2026-04-22)
- **D12** `focus_sessions` + Session 2026-04-21 polish (login a11y, Stage 5/6 cosmetic, entity-level RECENT) — squashes `e8e1d24` / `c838805` / `63ca09a` / `3389ded`
- **Redesign Stage 1–5** (frontend-only brutalist re-skin + mobile/PWA) — squashes `9be267f` / `a74c16f` / `e481587` / `540c6d4` / `45b989d` / `752db43` (2026-04-19…04-20)
- **Telegram bridge Phase 1–5 + security-profile-v2** — through squash `9ac7912` (2026-04-19), decommissioned 2026-05-15
- **Planner↔Hub Phase 2** — `af9a094` + follow-ups
- **Outreach CRM v2** (3 phases: Activity Log, Gmail Integration, Batch Outreach) — 2026-03-31

Each entry in the archive records: files touched, drift from plan, deferred items, known follow-ups, verification results at ship, cosmetic polish debt. Read the relevant archive section before planning adjacent work.
