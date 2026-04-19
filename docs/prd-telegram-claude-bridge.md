# PRD: Telegram to Claude Code Bridge

## Metadata
| Field | Value |
|-------|-------|
| Author | Dmitrii Vasichev |
| Date | 2026-04-17 |
| Status | Draft |
| Priority | P1 |

## Problem Statement

Claude Code (CC) runs as a local CLI on the Mac. This ties productive interaction with CC to physical presence at the workstation. On the road, in transit, or away from the desk, the full toolchain — planner, `/dev` workflow, note editing, codebase Q&A, full feature development — is inaccessible. The existing `/planner` skill solves mobility for one narrow slice (plan, complete, replan) by calling the Hub HTTP API directly, but the broader "talk to Claude and let it do anything" experience remains desk-bound.

The goal is a Telegram bot that acts as a **remote CC terminal**: text or voice messages from iOS Telegram arrive on the Mac, are forwarded to `claude -p --session-id=<current>` (reusing the Pro/Max subscription, not the Anthropic API), and CC's response is piped back. CC inside the subprocess has access to every skill (`/planner`, `/dev`, `/english`, etc.), the filesystem, and any tool not blocked by a dedicated `settings.json` deny-list profile.

## Goals and Non-Goals

### Goals
- Enable any CC interaction (planner ops, codebase Q&A, full `/dev` feature build) from an iOS Telegram client.
- Preserve the Pro/Max subscription (no Anthropic API billing).
- Isolate destructive operations behind an explicit PIN-based unlock window.
- Make personal reference data (`~/Documents/Notes/Personal/**`) permanently unreadable to Telegram-invoked CC, regardless of unlock state.
- Voice-in support for on-the-road use (local transcription, no cloud roundtrip).

### Non-Goals
- Voice-out (TTS) replies — deferred; revisit after MVP use.
- LLM-based per-message classifier (Layer 4 from `prd-planner-hub-phase1.md`) — replaced by the combination of whitelist, Face ID, `settings.json` deny-lists, and PIN-based unlock.
- Multi-tenant bot. Single user by design. Whitelist has exactly one `telegram_user_id`.
- Hosting the bot anywhere except the user's Mac.
- Named or parallel CC sessions (`/session work`, `/sessions`, `/resume <id>`).
- TG Mini App UI or custom bot menu.
- Full `stream-json` block-by-block forwarding of every CC tool-use event to Telegram.

## User Scenarios

### Scenario 1: Planner ops from phone
**As** the user, **I want to** ask "что у меня сегодня" or "отметь выполнено первый пункт" from Telegram, **so that** I can manage the day without opening the laptop.

### Scenario 2: Voice notes on the road
**As** the user, **I want to** record a voice note in Telegram ("создай заметку ..."), **so that** it is transcribed locally via faster-whisper and handed to CC to store in Notes.

### Scenario 3: Feature development on the go
**As** the user, **I want to** describe a new Hub feature in Telegram and have CC run the full `/dev plan` then `/dev build` workflow, **so that** I can kickstart work while in transit and review the result at the desk.

### Scenario 4: Codebase Q&A
**As** the user, **I want to** ask "как работает Phase 2 auth token flow" from Telegram, **so that** CC reads the relevant files and summarises back without me switching context.

### Scenario 5: Danger unlock for destructive ops
**As** the user, **I want to** type `/unlock <pin>` to grant the bot ten minutes of access to destructive operations (git push, file deletion), **so that** routine work is frictionless but accidental or impersonated requests are blocked.

## Functional Requirements

### P0 (Must Have)

#### Bot runtime and wire-up
- [ ] FR-1: New top-level `telegram_bot/` Python package with its own `requirements.txt`, `.env`, entry point `main.py`. Does not import `backend/app/*`.
- [ ] FR-2: `python-telegram-bot` v20+ async-mode bot, started via `@BotFather` token in env.
- [ ] FR-3: launchd LaunchAgent plist for auto-start on login and `KeepAlive=true` crash recovery. Install helper `scripts/install-bot-launchd.sh`.
- [ ] FR-4: Configuration via env vars: `TELEGRAM_BOT_TOKEN`, `HUB_API_URL`, `HUB_API_TOKEN`, `WHISPER_MODEL_SIZE` (default `small`), `CC_BINARY_PATH` (default `claude`), `CC_WORKDIR` (default `~/Documents/my_projects/my-personal-hub`).

#### Auth and whitelist
- [ ] FR-5: On every incoming update, the bot calls `POST /api/telegram/auth/check-sender` with `telegram_user_id` from the update. If the sender is not whitelisted, the update is silently ignored (no reply in TG, no identifiable entry in logs).
- [ ] FR-6: New Hub endpoint `POST /api/telegram/auth/check-sender` — authenticated via the existing `api_tokens` mechanism (the bot stores a `phub_…` token in `telegram_bot/.env`; endpoint resolves the owner via the hybrid `get_current_user` dep that already accepts both JWT and API tokens). Body `{telegram_user_id}`. Returns `{hub_user_id}` if `users.telegram_user_id == requested_id`, else 404.
- [ ] FR-7: New Hub endpoint `POST /api/telegram/auth/verify-pin` — same hybrid auth as FR-6, body `{pin}` (owner id comes from auth, not body). Bcrypt-compares against `users.telegram_pin_hash`. Returns `{ok: true}` or 401. **Rate-limited**: 5 failed attempts within 10 minutes per `user_id` triggers a 15-minute lockout returning 429. Counter state is in-memory per backend process (single-tenant, resets on restart).
- [ ] FR-8: New Hub endpoint `PUT /api/users/me/telegram-pin` — authenticated via `get_current_user` (JWT session token from the Settings UI), body `{pin}` (4–8 digits). Hashes with bcrypt, writes `users.telegram_pin_hash`.
- [ ] FR-9: New Hub endpoint `PUT /api/users/me/telegram-user-id` — authenticated via `get_current_user`, body `{telegram_user_id: int}`. Writes `users.telegram_user_id`.
- [ ] FR-10: Settings UI addition — new section "Telegram Bridge" inside the existing Settings → **Telegram** tab, rendered below the existing Pulse section. As part of the addition the existing section's heading is renamed from "Telegram Connection" to "Telegram Pulse" to disambiguate. The Bridge section contains:
  - Input to set `telegram_user_id` (numeric).
  - Input plus button to set or rotate PIN.
  - Status indicator: whether both fields are configured (green/yellow badge).
- [ ] FR-11: `/unlock <pin>` command — bot calls `verify-pin`; on success, stores `unlock_until = now() + 10min` in bot's in-memory state for that chat, replies "🔓 unlocked for 10 min". On 401 replies "⛔ wrong PIN". On 429 replies "⛔ too many attempts. Retry in ~N min." with the `N` extracted from the backend's error detail.
- [ ] FR-12: Danger-zone enforcement — CC subprocess is launched with a dedicated `settings.json` profile via `claude -p --settings <path>`. When `unlock_until` is in the past or unset, the profile is `locked.settings.json`. While unlocked, it is `unlocked.settings.json`. Specific rules:
  - Both profiles deny `Bash(sudo*)`, `Bash(curl*)`, `Bash(wget*)`, `Bash(rm -rf*)`, and — enumerated per tool — `Read`, `Edit`, `Write`, `Glob`, `Grep` under `/Users/dmitry.vasichev/Documents/Notes/Personal/**`.
  - `locked` additionally denies `Bash(git push*)` and `Bash(rm*)` (the non-`-rf` form).
  - `unlocked` allows `Bash(git push*)` and `Bash(rm*)` (still without `-rf`). `Bash(rm -rf*)` remains denied in both profiles so that a compromised 10-minute window cannot wipe directories.

#### Session management

> Note: `claude -p --session-id <X>` validates that `<X>` is a valid UUID; arbitrary symbolic strings are rejected with `Error: Invalid session ID. Must be a valid UUID.` The bot therefore stores and passes UUIDs; logical names like `"tg-default"` live only in logs and user-facing text.

- [ ] FR-13: Bot keeps `current_session_uuid` per chat. Default on first run: `uuid.uuid5(uuid.NAMESPACE_DNS, "tg-default")` — a deterministic UUID so the same CC conversation is resumed across bot restarts. The logical label "tg-default" is reserved for logging and for the `/status` reply.
- [ ] FR-14: `/new` command generates a fresh `uuid.uuid4()`, persists it keyed by `chat_id` in `telegram_bot/.state.json`, and replies "🆕 new session: `<uuid>`". Old sessions are left on disk untouched.
- [ ] FR-15: Every text or transcribed-voice message is forwarded as a single non-interactive `claude -p` invocation against `<current_uuid>`. The flag is `--session-id <uuid>` when no session file exists yet for that UUID in the workdir and `--resume <uuid>` otherwise — the CLI rejects `--session-id` for an existing UUID with "already in use".

#### CC invocation and output
- [ ] FR-16: CC launched via `asyncio.create_subprocess_exec`, stdout and stderr captured. Subprocess timeout 300 seconds (configurable via `CC_TIMEOUT`).
- [ ] FR-17: On message receipt the bot immediately posts a status message "🤔 thinking…", captures its `message_id`. Status edits happen only on real state transitions — either the final CC result (Phase 1) or, later, discrete tool-use events parsed from `--output-format stream-json` (Phase 3). No timer-driven "spinner" animation in any phase. Minimum interval between consecutive edits of the same message is **≥ 10 seconds** to stay well clear of Telegram's anti-abuse thresholds (see NFR "Anti-abuse hygiene").
- [ ] FR-18: When CC finishes, the bot sends the final reply as a new message. If the reply exceeds 4096 characters it is split on paragraph or code-fence boundaries into multiple messages.
- [ ] FR-19: On CC crash or non-zero exit code the bot replies "⚠️ CC error: `<last stderr line>`" and updates the status to "❌ failed".

#### Concurrency
- [ ] FR-20: Per-chat `asyncio.Queue`. A second message arriving while CC is busy causes the bot to reply "⏳ in queue (pos N)" and wait. Max queue depth is 5; the 6th arrival replies "⛔ queue full, try later" and is dropped.
- [ ] FR-21: When a queued message's turn comes, its status message transitions from "⏳ in queue" to "🤔 thinking".

#### Voice input
- [ ] FR-22: Voice-message handler downloads the Opus `.ogg` blob, invokes `faster-whisper` (model `small`, lazy-loaded on first voice message, language auto-detect among `ru` and `en`), returns a transcript.
- [ ] FR-23: Before forwarding to CC, the bot posts "🎙 transcribed: <first 200 chars…>" so the user sees what CC is about to process. The transcript then travels the same path as a text message (queue, CC invocation).
- [ ] FR-24: The `.ogg` blob is deleted from `/tmp` immediately after transcription, success or failure.

### P1 (Should Have)
- [ ] FR-25: `/status` command — bot replies with current session id, queue depth, unlock state (locked, or unlocked until HH:MM).
- [ ] FR-26: `/cancel` command — if a CC subprocess is active for the chat, send SIGINT and update status to "🛑 cancelled by user".
- [ ] FR-27: `/help` command listing available commands.
- [ ] FR-28: CLI helper `telegram_bot/scripts/generate_plist.py` that reads the local config and emits the launchd plist to stdout for one-shot install.

### P2 (Nice to Have)
- [ ] FR-29: Optional progress-edit cadence config (`TELEGRAM_PROGRESS_EDIT_SECONDS`).

## Non-Functional Requirements

- **Performance.** Median bot-side forwarding overhead (receive message → `claude -p` spawned; CC finished → reply sent) ≤ 500 ms, excluding CC compute. Voice transcription `small` model on M-series: real-time factor ≤ 3x for a 30-second voice note.
- **Availability.** Bot restarts automatically on crash via launchd `KeepAlive`. Mac sleep is already prevented by Amphetamine (configured in the Phase 1 infra; no change here). Expected uptime ≥ 95 % while Mac is awake.
- **Security.**
  - Only the whitelisted `telegram_user_id` receives responses; others are silently ignored.
  - CC subprocess always runs with a deny-list `settings.json` profile.
  - `~/Documents/Notes/Personal/**` is denied under both `locked` and `unlocked` profiles.
  - Bot token and Hub API token live only in `.env` (chmod 600, not committed).
  - PIN is stored as a bcrypt hash; the raw PIN is never logged.
- **Privacy.** Voice blobs are transient: downloaded, transcribed, deleted. No persistent voice storage.
- **Observability.** Bot logs to `~/Library/Logs/com.my-personal-hub.telegram-bot.log` via launchd stdout/stderr redirection. Log rotation uses `RotatingFileHandler`, 5 MB × 5 files.
- **Anti-abuse hygiene.** The bot MUST NOT emit Telegram API traffic patterns that resemble spam/automation bursts. Concretely:
  - **No animated status messages.** The status message is edited at most once per CC invocation — on the final state transition (`✅ done` / `❌ failed` / `⏱ timed out` / similar). If a richer progress scheme is added later (e.g., Phase 3 `stream-json` tool-use parsing), edits are gated on real CC state transitions and the minimum interval between consecutive edits of the same message is **≥ 10 seconds**.
  - **Chunked replies are paced.** When a long CC reply is split into multiple `sendMessage` calls, consecutive sends are separated by at least 0.5 seconds.
  - **No extra webhook churn on start.** The bot does not pass `drop_pending_updates=True` to `run_polling`. PTB still issues a single `deleteWebhook` per start to switch into polling mode — that one call is expected and not an abuse signal; the rule is only not to layer additional flags or repeated calls on top of it.
  - **No burst on first run.** After a fresh `@BotFather` token is issued, the bot owner is expected to wait at least a few minutes and send one probe message before any heavier traffic. Creating a new token and immediately firing `getMe` → `deleteWebhook` → `getUpdates` → many `editMessageText` calls is a known anti-abuse trigger (2026-04-18 incident: our first bot `dv_cc_bridge_bot` was frozen by Telegram within minutes of a 2-second-cadence spinner; the owner's sessions were cascade-terminated as a precaution).
  - **Rationale.** Telegram's automated classifier acts on traffic-pattern metadata, not message content. A fresh token combined with high-frequency edits and instantaneous replies is the closest heuristic match to a spam campaign.

## Technical Architecture

### Stack
- Python 3.11+ (match existing backend).
- `python-telegram-bot==21.x` (async).
- `faster-whisper==1.x` (CPU/Metal on M-series).
- `httpx==0.27.x` (async Hub API client).
- `pydantic==2.x` (config validation).
- `bcrypt==4.x` (server-side PIN hashing; already a backend dep).

### Runtime topology

```
iOS Telegram ──► Telegram Cloud ──► python-telegram-bot (long-poll) on Mac
                                          │
                                          ├─► faster-whisper (local)          [voice]
                                          ├─► asyncio.subprocess → claude -p --session-id=X
                                          │                              │
                                          │                              └─► all skills + FS
                                          │                                  bounded by
                                          │                                  settings.json deny-list
                                          │
                                          └─► httpx ──► Hub API on Railway
                                                       (check-sender, verify-pin)
```

### CC settings.json deny-list profiles

Two profiles ship in `telegram_bot/profiles/`:

**`locked.settings.json`** (default):
- Denies: `Bash(git push*)`, `Bash(rm -rf*)`, `Bash(sudo*)`, `Bash(curl*)`, `Bash(wget*)`, and all tool access under `~/Documents/Notes/Personal/**` (`Read`, `Edit`, `Write`, `Glob`, `Grep`).
- Allows everything else (project file I/O, skill invocations, `git commit`, `npm`, `pytest`, etc.).

**`unlocked.settings.json`** (active during a 10-minute unlock window):
- Same as `locked` but **allows** `Bash(git push*)` and `Bash(rm*)` within the project directory.
- Still denies `sudo`, network egress, and `~/Documents/Notes/Personal/**`.

Exact rule syntax follows the existing `~/.claude/settings.json` schema.

### Bot state on Mac

Persistent: `telegram_bot/.state.json`
```json
{
  "sessions": { "<chat_id>": "<uuid>" }
}
```

In-memory only (lost on bot restart → re-unlock required):
- `unlock_until: dict[chat_id, datetime]`
- `queues: dict[chat_id, asyncio.Queue]`
- `active_subprocess: dict[chat_id, asyncio.subprocess.Process | None]`

### Pre-existing infrastructure (reused by Phase 2)

Phase 2 reuses four pieces already shipped in prior phases — no fresh build-out required:

- **`users.telegram_user_id` + `users.telegram_pin_hash` columns** — pre-provisioned by Alembic revision `6e6fee7795cb` (Phase 1, Task 1) with the unique constraint and index already in place. Phase 2 does **not** add a migration.
- **`api_tokens` table + `app/services/api_token.py` + `POST /api/auth/tokens` endpoint + Settings → API Tokens UI** — the bot authenticates by minting a `phub_…` token through the UI and storing it in `telegram_bot/.env` as `HUB_API_TOKEN`. No separate bot shared-secret.
- **`app/core/deps.py:get_current_user`** — already resolves both JWT session tokens and `phub_…` API tokens through one dependency. All four Phase 2 endpoints hang off this.
- **`app/core/security.py:hash_password` / `verify_password`** — bcrypt helpers used for the PIN.

### Hub API additions

| Endpoint | Auth | Body | Returns |
|----------|------|------|---------|
| `POST /api/telegram/auth/check-sender` | `get_current_user` (bot's `phub_…` API token) | `{telegram_user_id}` | `{hub_user_id}` or 404 |
| `POST /api/telegram/auth/verify-pin` | `get_current_user` (bot's `phub_…` API token) | `{pin}` | `{ok: true}` / 401 / 429 (locked out) |
| `PUT /api/users/me/telegram-pin` | `get_current_user` (JWT session) | `{pin}` (4–8 digits) | 204 |
| `PUT /api/users/me/telegram-user-id` | `get_current_user` (JWT session) | `{telegram_user_id}` | 204 |

### Progress-event parsing

`claude -p --output-format stream-json` emits line-delimited JSON events. The bot parses tool-use events (`tool_use` with a `name` field) and maps to short, Russian-friendly status lines:

- `Read` → `reading <path basename>`
- `Edit` / `Write` → `writing <path basename>`
- `Bash` → `running: <command truncated to 60 chars>`
- `Grep` / `Glob` → `searching files`
- Skill / Task invocations → `using skill: <name>`

**Fallback (malformed / empty stream-json).** The bot does **not** fall back to a spinner — animated status edits are the exact pattern that triggered the 2026-04-18 anti-abuse freeze. Instead, when stream-json output is malformed or empty for an invocation, the status message is left at the initial "🤔 thinking…" until the final state transition ("✅ done" / "❌ failed" / "⏱ timed out"). Two edits total per request, worst case.

**First-run grace period.** A feature flag `TELEGRAM_PROGRESS_ENABLED` (default: `false`) gates all intermediate progress edits. The owner is expected to leave it off for ~48 hours after the first bot start to let Telegram's anti-abuse classifier build a non-spam baseline on the token, then flip it on manually. When disabled, the bot behaves exactly like Phase 2 — one "🤔 thinking…" at start, one terminal edit at the end.

### Voice transcript preview

`/voice` messages are always echoed back as "🎙 transcribed: `<full transcript>`" **regardless of length**, before the transcript is forwarded to CC. Rationale: `faster-whisper` misrecognitions on short commands (3–5 words) are the most dangerous — a single wrong verb can flip intent (e.g., "don't push" → "push", "keep" → "kill"). Showing the transcript always lets the owner catch the error before CC acts on it. Cost: one extra sendMessage per voice note; paced by the existing chunk-send interval (≥0.5 s).

### `/cancel` semantics

`/cancel` sends `SIGINT` to the active `claude -p` subprocess for the chat. This stops CC from starting the next tool call, but **does not roll back work CC has already completed** — if CC already applied a migration or made a commit before the cancel, those changes persist. The bot's cancel reply explicitly warns the owner:

> 🛑 stopped. Some actions may have already executed — check state manually.

This trade-off is accepted for MVP; richer semantics (require double-confirm, or refuse cancel once any write tool has run) are deferred.

## Implementation Phases

### Phase 1 — Foundation (text-only, no safety)
Goal: prove the wire-up works end-to-end.
- `telegram_bot/` package scaffold (FR-1, FR-4).
- Text handler that calls `claude -p` against `uuid5(NAMESPACE_DNS, "tg-default")` (FR-2, FR-15, FR-16, FR-18, FR-19).
- Single static "🤔 thinking…" status message; one terminal edit (`✅ done` / `❌ failed` / `⏱ timed out`). No spinner animation.
- Hardcoded whitelist by reading `telegram_user_id` from env var (no Hub call yet).
- Manual start via `python main.py`, no launchd.

### Phase 2 — Auth, PIN, settings.json profiles
- Hub endpoints: `check-sender`, `verify-pin`, `telegram-pin`, `telegram-user-id` (FR-5–FR-9).
- Replace env whitelist with Hub `check-sender` call.
- Settings UI for both fields (FR-10).
- `/unlock` command and in-memory `unlock_until` (FR-11).
- `locked.settings.json` and `unlocked.settings.json` profiles, invocation switching (FR-12).
- Session management: `/new`, `.state.json`, per-chat `current_session_id` (FR-13, FR-14).

### Phase 3 — Voice, queue, progress parsing
- Voice handler with faster-whisper lazy-loaded `small` (FR-22, FR-23, FR-24). CPU-only inference for MVP; Metal acceleration deferred to follow-up issue.
- Per-chat `asyncio.Queue` with depth 5 (FR-20, FR-21).
- Progress parsing from `stream-json` (FR-17), gated by `TELEGRAM_PROGRESS_ENABLED` feature flag (see "Progress-event parsing" section for grace-period rationale).
- `/status`, `/cancel`, `/help` (FR-25, FR-26, FR-27). `/cancel` semantics documented under "Technical Architecture".
- ~~Chunked long-reply splitting (FR-18)~~ — **shipped in Phase 2** (`telegram_bot/chunker.py` + `main.py`). Not re-done here.

### Phase 4 — Productionise
- launchd LaunchAgent plist + install script + plist generator (FR-3, FR-28).
- Log rotation (NFR observability).
- Setup guide in `docs/telegram-bridge-setup.md`: @BotFather flow, Face ID on iOS Telegram, Amphetamine verification, first-run checklist.
- Verification of AC-1 through AC-8.

## Acceptance Criteria

- [ ] AC-1: Sending "что у меня сегодня" from the whitelisted TG account returns today's plan via the `/planner` skill.
- [ ] AC-2: Sending a voice note "добавь задачу позвонить маме" transcribes within ~5 seconds on M-series, then CC creates the task via the `/planner` skill and confirms.
- [ ] AC-3: Sending `/unlock 0000` with wrong PIN replies "⛔ wrong PIN"; correct PIN replies "🔓 unlocked for 10 min".
- [ ] AC-4: While unlocked, asking CC to `git push` succeeds; while locked, the same request returns a deny-list error gracefully relayed to Telegram.
- [ ] AC-5: Bot survives `kill -9` — launchd restarts it within 10 seconds.
- [ ] AC-6: An unknown Telegram account sending a message gets no reply and leaves no identifiable trace in the log (silent drop).
- [ ] AC-7: `/new` creates a fresh session, and a subsequent "что мы только что обсуждали" returns a neutral "I don't have that context" response, proving continuity was reset.
- [ ] AC-8: Sending 6 messages in a burst while CC is busy: first 5 queue visibly, 6th gets "⛔ queue full".
- [ ] AC-9: Attempting to read a file under `~/Documents/Notes/Personal/**` — both locked and unlocked — is blocked.

## Risks and Open Questions

- **Progress-parsing fidelity.** The cleanliness of `--output-format stream-json` in the current CC version is unknown. A 30-minute spike in Phase 3 will decide whether to wire FR-17 or fall back to spinner-only.
- **`faster-whisper` on M-series.** May need specific install flags for Metal acceleration. Confirm in setup guide; default to CPU inference if Metal path is fragile.
- **`claude` CLI under launchd.** launchd-spawned processes do not inherit the interactive shell `PATH`. Mitigate by requiring an absolute `CC_BINARY_PATH` in env.
- **Bot token rotation.** No automated rotation in MVP; rely on @BotFather manual revoke plus `.env` update.
- **Session bloat.** Relying on the user to issue `/new` means `tg-default` may grow unbounded over months. Accepted risk; add `/new` reminder in `/help`. If this becomes a practical problem, follow-up issue for auto-rotation.
