# PRD: Planner ↔ Personal Hub integration — Phase 2 (Skill port + API tokens)

## Metadata

| Field | Value |
|-------|-------|
| Author | Dmitrii Vasichev |
| Date | 2026-04-17 |
| Status | Draft |
| Priority | P0 |
| Discovery | [discovery-2026-04-17-planner-hub-phase2.md](./discovery-2026-04-17-planner-hub-phase2.md) |
| Depends on | Phase 1 — [prd-planner-hub-phase1.md](./prd-planner-hub-phase1.md) (shipped) |

## Problem Statement

After Phase 1, the Planner API in `my-personal-hub` exists but has no writers — all new plans are still created by the `/planner` skill as markdown files in a Drive-synced folder. The hub does not see the plans the user actually builds; the skill does not see the hub's tasks, reminders, or calendar events when planning.

Phase 2 closes the loop: the skill becomes an HTTP client of the Planner API, the hub's DB becomes the only writer target for new plans, and a minimal API-token mechanism is introduced so the local skill can authenticate against the hosted backend. Markdown files are no longer written anywhere (deferring human-readable rendering to Phase 4's UI).

## User Scenarios

### Scenario 1: First-time setup
**As the** user, **I want to** generate an API token once in the hub Settings page and paste it into the skill's config, **so that** the skill can call the Planner API on my behalf without repeatedly logging in.

### Scenario 2: Morning planning
**As the** user, **I want to** run `/planner plan 5h` and have the skill pull today's pending tasks, reminders, calendar events, and yesterday's adherence from the hub, merge them with sub-agent top-actions, and persist the resulting plan to the hub DB, **so that** the hub becomes the single source of truth from the first session.

### Scenario 3: Completing a task during the day
**As the** user, **I want to** say "я закончил английский, 45 минут" and have the skill resolve that to the right item and PATCH the hub, **so that** completion state updates in DB without re-uploading the whole plan.

### Scenario 4: Replanning
**As the** user, **I want to** run `/planner replan` mid-day and have the skill POST a new plan for today, **so that** the hub records a `replans_count` increment and replaces items atomically.

### Scenario 5: Checking status
**As the** user, **I want to** run `/planner status` or `/planner history 2026-04-10` and see the plan from the hub, **so that** history viewing works without local markdown files.

### Scenario 6: Token revocation
**As the** user, **I want to** revoke a token from Settings if I ever suspect it leaked, **so that** the next skill call fails and I know to paste a fresh token.

## Functional Requirements

### P0 (Must Have)

#### API tokens — backend

- [ ] **FR-1:** `ApiToken` model: `id` (PK), `user_id` (FK → users, CASCADE, indexed), `name` (String(100), user-facing label, e.g. "planner-skill-macbook"), `token_hash` (String(255), bcrypt/argon2), `token_prefix` (String(12), first 8 chars of the raw token for UI display, e.g. `phub_a1b2c3d4`), `last_used_at` (DateTime, nullable), `created_at`, `revoked_at` (DateTime, nullable). Unique constraint on `(user_id, name)`.
- [ ] **FR-2:** Alembic migration adds `api_tokens` table.
- [ ] **FR-3:** Raw tokens are generated as `phub_` + 40 random URL-safe bytes base64-encoded. Raw value is shown once on creation; never retrievable again. Hash stored server-side.
- [ ] **FR-4:** `POST /api/auth/tokens` — body `{name}`. Returns `{id, name, token_prefix, raw_token, created_at}` with `raw_token` populated **only on this response**. Demo user receives 403.
- [ ] **FR-5:** `GET /api/auth/tokens` — list current user's non-revoked tokens: `[{id, name, token_prefix, created_at, last_used_at}]`.
- [ ] **FR-6:** `DELETE /api/auth/tokens/{id}` — sets `revoked_at`. Returns 204. 404 if not owned by current user.
- [ ] **FR-7:** `get_current_user` dependency extended: when `Authorization: Bearer <token>` is presented, accept either (a) a valid JWT (existing path) or (b) a valid, non-revoked API token whose hash matches. On API-token match, `last_used_at` is updated (fire-and-forget; no transaction blocker). Token prefix matching first narrows the candidate set (indexed).
- [ ] **FR-8:** Invalid or revoked tokens → 401. Rate limiting out of scope for this phase (not abused in practice).

#### Shortcut endpoints

- [ ] **FR-9:** `GET /api/planner/plans/today` — resolves today via `user.timezone`, delegates to `get_plan`. 404 if no plan exists.
- [ ] **FR-10:** `PATCH /api/planner/plans/today/items/{item_id}` — resolves today, delegates to `update_item`. Same 404/403 semantics as dated variant.

#### API tokens — frontend

- [ ] **FR-11:** New section in Settings page: "API Tokens". Lists non-revoked tokens with name, prefix, created, last used. Buttons: **Create new** (opens modal asking for name; on create shows the raw token once with a copy-to-clipboard button and a warning "This will not be shown again"), **Revoke** (confirmation dialog).
- [ ] **FR-12:** Uses shadcn components matching the rest of Settings. No visual redesign needed.

#### Skill port

- [ ] **FR-13:** `config.yaml` gains new section:
  ```yaml
  api:
    base_url: "https://my-personal-hub-backend.up.railway.app"
    token_file: "~/.claude/skills/planner/.auth"
    timeout_seconds: 30
  ```
  `.auth` is a single-line file with the raw token (0600 permissions). Skill reads it on invocation. If missing or empty → stop with a clear setup message directing the user to Settings.
- [ ] **FR-14:** `prompts/plan-day.md` rewritten: replaces "check for existing plan file → write file → show plan" with "GET `/plans/today` → if 200, ask overwrite/replan/cancel; if 404, proceed → sub-agent dispatch + `GET /context` in parallel → merge → allocate → POST `/plans` → show response". Drive filesystem logic removed.
- [ ] **FR-15:** `prompts/replan.md` rewritten: GET today's plan (must exist, else 404 error) → recompute remaining time → sub-agent dispatch + `/context` → POST `/plans` (full-replace; increments `replans_count` server-side).
- [ ] **FR-16:** `prompts/complete-task.md` rewritten: GET today's plan → LLM-resolve user's natural-language reference ("английский", "первая задача") to a single item → PATCH `/plans/today/items/{id}` with `status=done, minutes_actual=N, notes?`. On ambiguity (multiple matches), ask one clarifying question.
- [ ] **FR-17:** `prompts/show-status.md` rewritten: `today` → GET `/plans/today`; `history YYYY-MM-DD` → GET `/plans/{date}`; `week` → GET `/analytics?from=X&to=Y`. Render concisely in Russian.
- [ ] **FR-18:** `prompts/status-check.md` unchanged — sub-agent dispatch logic stays as is (still the source of programmatic "top actions").
- [ ] **FR-19:** New shared helper `prompts/_api-helpers.md` documents the three HTTP operations the skill performs (GET, POST, PATCH), required headers, error handling rules, and the exact curl-like shape for each endpoint. Reduces duplication across the rewritten sub-prompts.
- [ ] **FR-20:** Error handling — every HTTP call wrapped with a standard error policy:
  - Network error / timeout / 5xx → stop with "Backend unavailable. Check internet or Railway status."
  - 401 → stop with "API token invalid or revoked. Generate a new one at {base_url}/settings/tokens and update `.auth`."
  - 403 (demo user) → stop with "Current token belongs to a demo account; writes not allowed."
  - 404 on expected-exists (GET today's plan during replan) → surface to user as "No plan for today — create one first with /planner plan <hours>".

#### Sub-agent + context merge

- [ ] **FR-21:** During plan creation/replan, skill issues sub-agent dispatches (via Task tool, parallel) AND `GET /context` in the same message. On all responses collected:
  1. Sub-agent outputs produce "program tasks" tagged `[skill: <name>, category: <category>]`.
  2. `/context.pending_tasks` produce "hub tasks" tagged `[source: hub_task_<id>, category: <task.category or "life">]`.
  3. `/context.due_reminders` produce short high-priority items tagged `[source: hub_reminder_<id>]`, inserted into the earliest slot.
  4. `/context.calendar_events` are treated as blocked time — not items, but time ranges excluded from planning.
  5. `/context.yesterday` is rendered as a one-line header before the plan ("Вчера: X% адекватности, Y min выполнено").
- [ ] **FR-22:** Dedup at merge time — normalize title to lowercase, strip punctuation, collapse whitespace; if two items normalize identically, keep the one with explicit source (hub) and drop the sub-agent's to avoid double-booking a planned slot.

### P1 (Should Have)

- [ ] **FR-23:** Skill `config.yaml` template updated in `project-init` / bootstrap message so fresh setups guide the user to generate a token.
- [ ] **FR-24:** Each POST / PATCH call appends a single-line entry to `~/.claude/skills/planner/.log` for local audit (timestamp, operation, endpoint, status). Helps debug without DB access. Cap at 10 MB, rotate simple.

### P2 (deferred)

- Fuzzy resolver endpoint (server-side natural-language → item resolution) → Phase 3 if needed.
- Batch PATCH (multiple items one request) → Phase 3 if bot needs it.
- Offline outbox / sync → out of scope unless real pain shows up.

## Non-Functional Requirements

- **Performance:** Parallel sub-agent + `/context` keeps plan-day end-to-end under ~8s on a warm Railway (most time is sub-agent inference). 401/404 responses under 200ms.
- **Security:** Tokens hashed at rest (argon2 to match existing password hashing). Raw tokens never logged. `.auth` file documented with `chmod 600` guidance. Token prefix in logs/UI is non-secret.
- **Observability:** Backend logs token auth usage (`user_id`, `token_id`, `path`) at INFO. Failed auth at WARNING. Skill-side `.log` file for client-side debugging.
- **Migration safety:** Existing JWT flow untouched. API tokens are an additive auth path; no changes to session/cookie behavior.

## Technical Design

### Stack (unchanged)

- Backend: FastAPI + SQLAlchemy async + Postgres + Alembic + argon2-cffi (already in deps for password hashing)
- Frontend: Next.js 16 + shadcn
- Skill runtime: `claude` CLI with Bash + Task tools for HTTP via `curl`

### API tokens — data model

```
api_tokens
  id            PK
  user_id       FK(users) CASCADE, indexed
  name          String(100)
  token_hash    String(255)       # argon2, same hasher as passwords
  token_prefix  String(12), indexed  # first 8 chars for narrowing + UI display
  last_used_at  DateTime nullable
  created_at    DateTime
  revoked_at    DateTime nullable
  UNIQUE(user_id, name)
```

Raw token format: `phub_` + `secrets.token_urlsafe(30)` → ~45-char string. Example: `phub_Xk7Gn...`.
`token_prefix` stored = first 12 chars of the raw token (including `phub_`). Used to narrow candidate hashes during auth lookup (index scan → ≤ a handful of rows → argon2 verify each).

### Auth flow change (additive)

```python
# app/core/deps.py (sketch)
async def get_current_user(
    authorization: str = Header(...),
    db: AsyncSession = Depends(get_db),
) -> User:
    token = _extract_bearer(authorization)
    # Try JWT first (existing path, fast)
    try:
        return await _resolve_jwt(token, db)
    except JWTError:
        pass
    # Fall through to API token
    user = await _resolve_api_token(token, db)
    if user is None:
        raise HTTPException(401, "Invalid credentials")
    return user
```

`_resolve_api_token` matches by `token_prefix` (indexed), then argon2-verifies candidates, updates `last_used_at` in a background task (so the request doesn't block on a write).

### Shortcut endpoints

```python
@router.get("/plans/today", response_model=DailyPlanResponse)
async def read_plan_today(db, current_user):
    today = _today_for_user(current_user)
    plan = await planner_service.get_plan(db, current_user, today)
    if plan is None:
        raise HTTPException(404, "Plan not found")
    return plan

@router.patch("/plans/today/items/{item_id}", response_model=PlanItemResponse)
async def patch_item_today(item_id, payload, db, current_user):
    today = _today_for_user(current_user)
    item = await planner_service.update_item(db, current_user, today, item_id, payload)
    if item is None:
        raise HTTPException(404, "Plan item not found")
    return item
```

### Skill HTTP helper pattern

Skill uses Bash `curl` invocations embedded in sub-prompts (no separate binary). Standard shape:

```bash
curl -sS --max-time 30 \
  -H "Authorization: Bearer $(cat ~/.claude/skills/planner/.auth)" \
  -H "Content-Type: application/json" \
  -X <METHOD> \
  "$PLANNER_API_BASE/api/planner/<path>" \
  -d '<json>'
```

Exit code + HTTP status parsed with `-w "%{http_code}"`. Error branches defined in `_api-helpers.md`.

### File layout — backend

```
backend/app/models/api_token.py                 # new: ApiToken
backend/app/schemas/auth.py                     # MODIFIED: TokenCreate, TokenResponse, TokenListItem
backend/app/services/api_token.py               # new: create/list/revoke/resolve
backend/app/core/deps.py                        # MODIFIED: get_current_user supports API tokens
backend/app/api/auth.py                         # MODIFIED: 3 new endpoints
backend/app/api/planner.py                      # MODIFIED: 2 shortcut endpoints
backend/alembic/versions/<ts>_add_api_tokens.py
backend/tests/test_api_tokens.py                # integration tests
backend/tests/test_planner_today_shortcuts.py   # shortcut tests
```

### File layout — frontend

```
frontend/src/app/settings/tokens/page.tsx       # new: token list + create/revoke
frontend/src/components/settings/ApiTokensSection.tsx
frontend/src/lib/api/tokens.ts                  # client for /api/auth/tokens
frontend/src/app/settings/page.tsx              # MODIFIED: link/tab to Tokens
```

### File layout — skill

```
~/.claude/skills/planner/config.yaml            # MODIFIED: +api section
~/.claude/skills/planner/.auth                  # new: user-created, gitignored
~/.claude/skills/planner/prompts/plan-day.md    # rewritten
~/.claude/skills/planner/prompts/replan.md      # rewritten
~/.claude/skills/planner/prompts/complete-task.md  # rewritten
~/.claude/skills/planner/prompts/show-status.md  # rewritten
~/.claude/skills/planner/prompts/_api-helpers.md  # new: shared HTTP patterns
```

### Dedup logic (FR-22)

```python
def normalize(title: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^\w\s]", "", title.lower())).strip()

def dedup(merged_pool):
    seen = {}
    for item in merged_pool:
        key = normalize(item.title)
        existing = seen.get(key)
        if existing is None:
            seen[key] = item
        elif item.source == "hub" and existing.source != "hub":
            seen[key] = item   # prefer hub-originated
        # else keep existing
    return list(seen.values())
```

Logic implemented in the skill (prompt-level reasoning) since the merge happens in the skill; the backend sees only the final POST body.

## Out of Scope

- Any `.md` rendering (local or Drive-side). Phase 4 UI will handle human-readable views.
- Offline mode, local cache, outbox, or sync reconciliation.
- Telegram bot (Phase 3), voice input, fuzzy server-side resolver.
- Token rotation, expiry, scopes — tokens are long-lived and all-or-nothing for this phase.
- Rate limiting / abuse protection on the token auth path.
- OAuth for external clients.
- Per-skill tokens with limited scope (e.g., "planner-only"). Tokens grant full user access for now.
- Migration of sub-agent internal state into hub tasks.

## Acceptance Criteria

- [ ] **AC-1:** `alembic upgrade head` applies the `api_tokens` migration cleanly; `downgrade` reverts cleanly.
- [ ] **AC-2:** `POST /api/auth/tokens` with `{name: "test"}` returns a `raw_token` starting with `phub_`; immediately using it in `Authorization: Bearer` header against `GET /api/auth/me` returns the token's owner. Creating a second token with the same name returns 409.
- [ ] **AC-3:** `GET /api/auth/tokens` lists tokens with `token_prefix` visible and no hash or raw value leaked.
- [ ] **AC-4:** `DELETE /api/auth/tokens/{id}` revokes; subsequent use of that raw token returns 401.
- [ ] **AC-5:** Demo user gets 403 on `POST /api/auth/tokens`.
- [ ] **AC-6:** Existing JWT-based login/auth flow still works; a JWT presented as `Bearer` resolves the user as before.
- [ ] **AC-7:** `GET /api/planner/plans/today` returns today's plan via `user.timezone`; 404 when none.
- [ ] **AC-8:** `PATCH /api/planner/plans/today/items/{id}` with `{status: done, minutes_actual: 55}` updates item + recomputes plan aggregates (same behavior as dated variant).
- [ ] **AC-9:** Frontend Settings/Tokens page: create shows raw token once, copies to clipboard, warns about non-retrievability; list shows prefix only; revoke removes from the list.
- [ ] **AC-10:** Fresh skill invocation with no `.auth` file stops with a clear setup message pointing to Settings.
- [ ] **AC-11:** `/planner plan 5h` with a valid token: sub-agent dispatch + `/context` run in parallel (observable via logs), plan is POSTed, response shown to user in Russian. DB row exists under the user; no `.md` file written.
- [ ] **AC-12:** `/planner replan`: second POST for same date increments `replans_count` by 1 (verified by GET); full item replacement.
- [ ] **AC-13:** "я закончил X, 45 мин": skill resolves X to exactly one item, PATCHes today's shortcut, response includes recomputed plan aggregates. On ambiguous X, skill asks one clarifying question and does not PATCH.
- [ ] **AC-14:** `/planner history 2026-04-10` fetches via GET and renders; `/planner week` calls analytics and renders aggregates.
- [ ] **AC-15:** With backend down (simulated via invalid `base_url` in config), skill returns the hard-fail message — does NOT fall back to markdown or local cache.
- [ ] **AC-16:** Duplicate titles between sub-agent output and `/context.pending_tasks` merge to one item (hub source retained).

## Risks & Open Questions

1. **Token theft via `.auth` file.** If attacker has local filesystem access, they can exfiltrate the token. Mitigation: document `chmod 600`; UI surfaces `last_used_at` and token list so suspicious usage is visible; user can revoke instantly. Acceptable residual risk for a single-user local tool.

2. **Prompt-driven HTTP from skill is verbose.** The skill shells out to `curl` from Bash invocations guided by prompt text. Historically this has been reliable, but error handling lives in prompt text, which is fragile to LLM drift. Mitigation: the shared `_api-helpers.md` prompt pins exact curl shapes and error branches.

3. **Sub-agent vs `/context` duplication.** FR-22 dedup is simple and may miss semantically-equivalent phrasings ("English lesson" vs "Урок английского"). Mitigation: role-split rule in D4 means the hub doesn't carry English-lesson tasks; real overlap will be rare. If it becomes a problem, upgrade to LLM-based dedup on the skill side.

4. **Railway cold start.** First API call after idle can take 5–15 seconds. Hard-fail policy means a timeout would surface a confusing error. Mitigation: skill timeout set to 30s (FR-13); user-facing error message mentions "may be a cold start, try again once."

5. **Frontend Settings page routing conflict.** Existing `/settings` layout may need a sub-route or tab. Low risk — shadcn + Next.js App Router has standard patterns; will confirm during build.

6. **Sub-agent dispatch cost.** Each plan creation now runs 4+ sub-agents plus one HTTP call. Parallel dispatch keeps wall time bounded but token usage is higher. Accept for now; revisit if a cheap `/context`-only "lite" mode proves useful.

## Implementation phasing (within this PRD)

Phase 2 is a single deliverable, but can be built in 3 commit-sized stages:

1. **Stage A — Backend auth & shortcuts.** FR-1–10, AC-1–8. Self-contained, testable, no user-visible change yet.
2. **Stage B — Frontend token UI.** FR-11–12, AC-9. Depends on Stage A. Fully usable end state: user can generate tokens.
3. **Stage C — Skill port.** FR-13–22, AC-10–16. Depends on Stages A+B.

Each stage ends with verification (build + lint + smoke test) before moving on.
