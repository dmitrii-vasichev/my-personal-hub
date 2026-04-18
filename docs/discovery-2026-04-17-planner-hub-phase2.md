# Discovery: Planner ↔ Personal Hub integration — Phase 2

**Date:** 2026-04-17
**Author:** Dmitrii Vasichev
**Scope:** Port the `/planner` skill from markdown-in-Drive to HTTP API, define auth model for skill↔API calls, add shortcut endpoints for today's plan.

## Context

Phase 1 (shipped 2026-04-17) established `my-personal-hub` Postgres as the source of truth for daily plans via a full Planner API (`GET /context`, `POST /plans`, `GET /plans/{date}`, `PATCH /plans/{date}/items/{id}`, `GET /analytics`), consolidated `user.timezone`, and reserved Telegram security columns. The `/planner` skill still reads/writes markdown files in `~/Documents/Notes/Planner/daily-plans/`; the API has no writers. Phase 2 connects them.

## Decisions

### D1. Skill authentication — **service account token via UI**

Add a simple "API Tokens" section to the hub Settings page. User generates a long-lived token once, copies it into skill config (`~/.claude/skills/planner/config.yaml` under `api.token`). Skill sends `Authorization: Bearer <token>` on every request. Tokens are hashed at rest, revocable from the UI.

Rejected alternatives:
- Interactive email/password login from skill — adds a terminal login flow; not worth it for single-user local tool.
- Shared ENV secret — hackish; would be replaced again in Phase 3.

### D2. Offline behaviour — **hard fail**

If API is unreachable, skill returns a clear error ("Backend unavailable — try again later") and does not proceed. No offline outbox, no local `.md` fallback, no cache-based planning.

Rationale: Offline logic doubles skill complexity (outbox, reconciliation, conflict resolution). Railway uptime has been excellent and single-source-of-truth invariant is more important than offline ergonomics. If it ever hurts in practice, revisit as Phase 2.5.

### D3. Drive render — **not rendered, old `.md` files stay as archive**

Skill does not write `.md` files. Backend does not render to Drive. Old files in `~/Documents/Notes/Planner/daily-plans/` are untouched (migrated into DB by Phase 1 script); new plans live only in DB. Human-readable viewing is deferred to Phase 4 UI.

Rationale: Pure source-of-truth architecture. No divergence risk. When UI arrives (Phase 4), it covers human readability. FR-17 from Phase 1 PRD is formally dropped.

### D4. Task source model — **hybrid: sub-agents + `/context`, explicit role split**

Skill continues to dispatch sub-agents (english, career, linkedin, moving, …) in parallel for their "top actions for today", AND calls `GET /api/planner/context` to retrieve hub-owned data (pending_tasks, due_reminders, calendar_events, yesterday_adherence). Both streams merge into one task pool that the time-allocation algorithm distributes across slots.

Role split:
- **Sub-agents** own programmatic/progression data (next English lesson, next outreach candidate, next LinkedIn post). This state lives inside each skill — not synced to the hub.
- **`/context`** owns "life events" — ad-hoc tasks the user added via UI/Telegram, reminders, calendar, yesterday's adherence.

Dedup: on merge, group by normalized title; keep one if duplicated.

Rejected alternative: collapse everything into hub `Task`s (would require every sub-skill to sync its internal state into the hub — large effort, wrong abstraction for programmatic skills).

### D5. Telegram bot endpoints — **add `today` shortcuts now, defer bot-specific endpoints**

Phase 2 adds two shortcut endpoints:
- `GET /api/planner/plans/today` — returns today's plan (resolved via `user.timezone`). 404 if no plan.
- `PATCH /api/planner/plans/today/items/{item_id}` — same semantics as dated version, but resolves date server-side.

These are pure ergonomic shortcuts — useful for skill, future frontend, and future bot. No fuzzy resolver, no multi-step command endpoints, no voice-specific surfaces. Those wait for Phase 3 when real usage shapes them.

## Scope summary

1. Backend: API tokens infrastructure (model, service, generation endpoint, UI page) + auth dependency that accepts both JWT and API tokens.
2. Backend: `today` shortcut endpoints.
3. Skill: rewrite 5 sub-prompts to call HTTP API instead of reading/writing markdown.
4. Skill: add auth config + error handling for hard-fail on API unavailability.
5. Skill: merge sub-agent outputs with `/context` response, with dedup and role split.
6. Frontend: Settings page "API Tokens" section (generate, list, revoke).

## Out of scope

- `.md` rendering anywhere.
- Offline fallback / caching.
- Telegram bot itself — Phase 3.
- Fuzzy resolver (`/complete-by-description`) — Phase 3.
- Frontend analytics/charts — Phase 4.
- Migration of sub-agent state into hub tasks.

## Open risks

- Sub-agent dispatch from skill + HTTP call to `/context` in parallel — needs careful prompt work in the skill to keep it clean.
- Token revocation flow — if user revokes the token in UI, next skill call fails with 401; skill should detect and suggest re-pasting a new token.
- Railway cold starts — if the backend was idle, first request may take several seconds. Acceptable under hard-fail policy; skill should use a reasonable timeout (~30s).
