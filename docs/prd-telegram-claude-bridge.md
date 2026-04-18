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
- [ ] FR-6: New Hub endpoint `POST /api/telegram/auth/check-sender` — Bearer-auth with the bot's Phase 2 API token. Returns `{hub_user_id}` if `users.telegram_user_id == requested_id`, else 404.
- [ ] FR-7: New Hub endpoint `POST /api/telegram/auth/verify-pin` — Bearer-auth, body `{hub_user_id, pin}`. Bcrypt-compare against `users.telegram_pin_hash`. Returns `{ok: true}` or 401.
- [ ] FR-8: New Hub endpoint `PUT /api/users/me/telegram-pin` — JWT-auth, body `{pin}` (4–8 digits). Hashes with bcrypt, writes `users.telegram_pin_hash`.
- [ ] FR-9: New Hub endpoint `PUT /api/users/me/telegram-user-id` — JWT-auth, body `{telegram_user_id: int}`. Writes `users.telegram_user_id`.
- [ ] FR-10: Settings UI addition — new subsection "Telegram Bridge" in the existing Settings page with:
  - Input to set `telegram_user_id` (numeric).
  - Input plus button to set or rotate PIN.
  - Status indicator: whether both fields are configured.
- [ ] FR-11: `/unlock <pin>` command — bot calls `verify-pin`; on success, stores `unlock_until = now() + 10min` in bot's in-memory state for that chat, replies "🔓 unlocked for 10 min". On failure, replies "⛔ wrong PIN".
- [ ] FR-12: Danger-zone enforcement — CC subprocess is launched with a dedicated `settings.json` profile. When `unlock_until` is in the past or unset, the profile is `locked.settings.json`. While unlocked, it is `unlocked.settings.json`. Both profiles deny `~/Documents/Notes/Personal/**` unconditionally.

#### Session management

> Note: `claude -p --session-id <X>` validates that `<X>` is a valid UUID; arbitrary symbolic strings are rejected with `Error: Invalid session ID. Must be a valid UUID.` The bot therefore stores and passes UUIDs; logical names like `"tg-default"` live only in logs and user-facing text.

- [ ] FR-13: Bot keeps `current_session_uuid` per chat. Default on first run: `uuid.uuid5(uuid.NAMESPACE_DNS, "tg-default")` — a deterministic UUID so the same CC conversation is resumed across bot restarts. The logical label "tg-default" is reserved for logging and for the `/status` reply.
- [ ] FR-14: `/new` command generates a fresh `uuid.uuid4()`, persists it keyed by `chat_id` in `telegram_bot/.state.json`, and replies "🆕 new session: `<uuid>`". Old sessions are left on disk untouched.
- [ ] FR-15: Every text or transcribed-voice message is forwarded as a single non-interactive `claude -p` invocation against `<current_uuid>`. The flag is `--session-id <uuid>` when no session file exists yet for that UUID in the workdir and `--resume <uuid>` otherwise — the CLI rejects `--session-id` for an existing UUID with "already in use".

#### CC invocation and output
- [ ] FR-16: CC launched via `asyncio.create_subprocess_exec`, stdout and stderr captured. Subprocess timeout 300 seconds (configurable via `CC_TIMEOUT`).
- [ ] FR-17: On message receipt the bot immediately posts a status message "🤔 thinking…", captures its `message_id`. While CC is running, the bot edits the status with human-readable progress parsed from `--output-format stream-json` tool-use events. Minimum interval between edits is 2 seconds to respect Telegram rate limits.
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

### Hub API additions

| Endpoint | Auth | Body | Returns |
|----------|------|------|---------|
| `POST /api/telegram/auth/check-sender` | Bearer (bot token) | `{telegram_user_id}` | `{hub_user_id}` or 404 |
| `POST /api/telegram/auth/verify-pin` | Bearer (bot token) | `{hub_user_id, pin}` | `{ok: true}` or 401 |
| `PUT /api/users/me/telegram-pin` | JWT | `{pin}` (4–8 digits) | 204 |
| `PUT /api/users/me/telegram-user-id` | JWT | `{telegram_user_id}` | 204 |

### Progress-event parsing

`claude -p --output-format stream-json` emits line-delimited JSON events. The bot parses tool-use events (`tool_use` with a `name` field) and maps to short, Russian-friendly status lines:

- `Read` → `reading <path basename>`
- `Edit` / `Write` → `writing <path basename>`
- `Bash` → `running: <command truncated to 60 chars>`
- `Grep` / `Glob` → `searching files`
- Skill / Task invocations → `using skill: <name>`

If `stream-json` output is malformed or empty for a given invocation, the fallback is an animated spinner on the status message (dot cycling).

## Implementation Phases

### Phase 1 — Foundation (text-only, no safety)
Goal: prove the wire-up works end-to-end.
- `telegram_bot/` package scaffold (FR-1, FR-4).
- Text handler that calls `claude -p` with a fixed `session-id=tg-default` (FR-2, FR-15, FR-16, FR-18, FR-19).
- Status-message spinner without progress parsing.
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
- Voice handler with faster-whisper lazy-loaded `small` (FR-22, FR-23, FR-24).
- Per-chat `asyncio.Queue` with depth 5 (FR-20, FR-21).
- Progress parsing from `stream-json` (FR-17).
- Chunked long-reply splitting (FR-18).
- `/status`, `/cancel`, `/help` (FR-25, FR-26, FR-27).

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
