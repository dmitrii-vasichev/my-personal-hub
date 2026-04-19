# telegram_bot

Telegram bridge to Claude Code. A standalone Python process on the Mac receives
text messages from the bot owner's Telegram account, forwards the prompt to
`claude -p` under a deny-listed settings profile, and sends the reply back.

Phase 2 (shipped) adds Hub-backed sender whitelisting, PIN-gated `/unlock` for
destructive operations, locked/unlocked `settings.json` profiles, and per-chat
session management via `/new`. Voice, a request queue, progress parsing, and
launchd auto-start remain deferred to Phases 3–4.

Source PRD: `docs/prd-telegram-claude-bridge.md`.
Phase 1 plan: `docs/plans/2026-04-17-telegram-claude-bridge-phase1.md` (local only).
Phase 2 plan: `docs/plans/2026-04-18-telegram-claude-bridge-phase2.md`.

## Prerequisites

- Python 3.11+ (3.12 tested).
- `claude` CLI installed and authenticated (subscription). Confirm with `claude --version`.
- A Telegram account for the bot owner (you).
- Access to a deployed Personal Hub backend (Railway in this project).

## Setup

1. **Create the bot** — talk to [@BotFather](https://t.me/BotFather),
   `/newbot`, copy the token.
2. **Get your Telegram user id** — send any message to
   [@userinfobot](https://t.me/userinfobot), copy the numeric `Id` it replies with.
3. **Mint a Hub API token** — in the Hub UI, go to
   **Settings → API Tokens**, create a token named `telegram-bridge`, and copy
   the raw `phub_…` string. The token is shown only once; paste it straight
   into `telegram_bot/.env` as `HUB_API_TOKEN` in step 5.
4. **Configure your Telegram bridge identity in the Hub** — in the Hub UI,
   go to **Settings → Telegram → Telegram Bridge**, set your Telegram numeric
   id (from step 2) in `telegram_user_id`, and pick a 4–8 digit PIN. The PIN
   is hashed server-side and used to unlock destructive operations via
   `/unlock` (see [Unlock flow](#unlock-flow)).
5. **Configure `.env`**:
   ```bash
   cp telegram_bot/.env.example telegram_bot/.env
   ```
   Fill in:
   - `TELEGRAM_BOT_TOKEN` — from step 1.
   - `HUB_API_URL` — base URL of your deployed Hub backend
     (default `https://backend-api-production-1967.up.railway.app`).
   - `HUB_API_TOKEN` — the `phub_…` token minted in step 3.
   - `CC_BINARY_PATH` — run `which claude` and paste the absolute path.
   - `CC_WORKDIR` — absolute path to this repo's root.
   - `CC_TIMEOUT` — default 300s is fine.
   - `LOG_LEVEL` — `INFO` by default; `DEBUG` to see drop-events for
     non-whitelisted updates and Hub-client request traces.
   - `WHITELIST_TG_USER_ID` — **optional** offline fallback. Normal operation
     uses the Hub's `users.telegram_user_id` column (set in step 4); this env
     var is consulted only if the Hub is unreachable on startup. Safe to leave
     empty once the Hub is healthy.
6. **Install deps**:
   ```bash
   cd telegram_bot
   python -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

## Run

```bash
cd telegram_bot
source .venv/bin/activate
python main.py
```

Expected on start: a `starting bot polling` log line in stderr and in
`~/Library/Logs/com.my-personal-hub.telegram-bot.log`, followed by a successful
`hub_client.init` handshake against `HUB_API_URL`.

Send any text from the whitelisted Telegram account. Expected flow:

1. A static status message `🤔 thinking…` appears and stays unchanged while
   CC is running (no spinner animation — see "Anti-abuse hygiene" below).
2. On success: status is edited once to `✅ done`, then CC's reply arrives
   (chunked to ≤4000-char messages on paragraph / code-fence boundaries,
   with a short pause between chunks).
3. On non-zero exit: status becomes `❌ failed`, plus a short `⚠️ CC error`
   message with the last 3 stderr lines.
4. On timeout: status becomes `⏱ timed out`, plus a message noting that
   `CC_TIMEOUT` was exceeded.

Stop with `Ctrl-C`.

## Commands

- `/new` — reset the bot's conversation session for the current chat. The
  next message starts a fresh Claude Code session UUID; the previous
  `.jsonl` remains on disk but isn't resumed. Use when you want Claude to
  forget context.
- `/unlock <pin>` — unlock destructive operations for 10 minutes in the
  current chat. Bot replies:
  - `🔓 unlocked for 10 min` on success.
  - `⛔ wrong PIN` on mismatch.
  - `⛔ usage: /unlock <pin>` if the argument is missing or malformed.
  - `⛔ too many attempts. Retry in ~N min.` when the backend has rate-limited
    you (5 failures / 10 min → 15-minute lockout). See
    [Unlock flow](#unlock-flow) for what unlocking changes.

## Unlock flow

Every CC invocation runs under one of two `settings.json` profiles in
`telegram_bot/profiles/`. The profile is picked per message based on the
chat's unlock state.

- **`locked.settings.json`** (default for every chat on start, and after the
  10-minute window expires or the bot restarts):
  - Denies `Bash(git push*)`, `Bash(rm -rf*)`, `Bash(rm*)`, `Bash(sudo*)`,
    `Bash(curl*)`, `Bash(wget*)`.
  - Denies `Read`, `Edit`, `Write`, `Glob`, `Grep` on
    `~/Documents/Notes/Personal/**` (the tilde form is required — absolute
    paths with a single leading `/` are silently ignored by `claude -p`).
- **`unlocked.settings.json`** (active for 10 minutes after `/unlock <pin>`
  succeeds):
  - Allows `git push` and `rm` (without `-rf`).
  - Still denies `rm -rf`, `sudo`, `curl`, `wget`, and Personal/**.

`Notes/Personal/**` is **never** accessible via this bot, in any mode. That
deny-list entry is hardcoded in both profile JSONs with the tilde form
`~/Documents/Notes/Personal/**`.

Unlock state is **in-memory only**, keyed by `chat_id`. Restarting the bot
clears all unlocks; every chat must re-run `/unlock <pin>` to restore
destructive privileges.

## Anti-abuse hygiene

Fresh Telegram bot tokens are watched closely by Telegram's anti-abuse
classifier. On 2026-04-18 our first bot was frozen within minutes of going
live with a 2-second-cadence spinner + immediate polling + sub-second
replies — a pattern that looks to the classifier like an automated spam
campaign. This package avoids those signals:

- No timer-driven spinner. The `🤔 thinking…` status is edited exactly once
  per invocation, at the end.
- Chunked replies are paced (~0.7s between `sendMessage` calls).
- `drop_pending_updates=True` is not passed on startup. PTB still issues a
  single `deleteWebhook` per start to switch into polling mode — that is
  expected and not a signal; we just don't layer extra flags on top.

When creating a new bot via `@BotFather`, let it sit a few minutes before
sending any traffic. Prefer neutral usernames (avoid `_cc_`, `_claude_`,
`_bridge_` in combination with `_bot`).

## Session model

`--session-id` on the Claude CLI requires a valid UUID, so the bot stores a
per-chat UUID in `telegram_bot/.state.json` and passes it to `claude -p`. If
the session's `.jsonl` file already exists under
`~/.claude/projects/<encoded-workdir>/<uuid>.jsonl`, the bot switches to
`--resume` automatically (CC rejects `--session-id` for in-use UUIDs).

`/new` rotates the UUID for the current chat; the previous `.jsonl` is left
on disk untouched but is no longer referenced.

## Architecture — bot ↔ Hub handshake

The bot authenticates to the Hub with the `phub_…` API token from step 3,
passed as a `Bearer` header on every request from `telegram_bot/hub_client.py`:

- `POST /api/telegram/auth/check-sender` — called on every inbound update,
  with a 60-second per-chat cache. The Hub's hybrid
  `get_current_user` dependency resolves the token to the owning user and
  compares `current_user.telegram_user_id` against the request's
  `telegram_user_id`. Returns 200 on match, 404 on mismatch or unconfigured.
  On httpx transport failure the bot falls back to the `WHITELIST_TG_USER_ID`
  env var for the duration of that request only.
- `POST /api/telegram/auth/verify-pin` — called by `/unlock <pin>`. Returns
  200 on match, 401 on mismatch, 400 if no PIN is configured for this user,
  429 when the per-user in-memory rate-limit kicks in (5 failures / 10 min →
  15-minute lockout).

No new shared-secret mechanism was introduced for Phase 2 — the bot uses the
same `phub_…` scheme already served by `app/core/deps.py:get_current_user`
for every other API client.

## Troubleshooting

- **Bot silent after sending text** — check
  `~/Library/Logs/com.my-personal-hub.telegram-bot.log`. A `drop update from
  non-whitelisted id=…` line means `check-sender` returned 404 against the
  Hub, or the fallback env whitelist didn't match. Verify your
  `telegram_user_id` in **Settings → Telegram → Telegram Bridge** matches
  the numeric id reported by `@userinfobot`.
- **`ValidationError` on start** — one of the required env vars
  (`TELEGRAM_BOT_TOKEN`, `HUB_API_URL`, `HUB_API_TOKEN`, `CC_BINARY_PATH`,
  `CC_WORKDIR`) is missing or malformed. The error message lists which ones.
- **Bot starts but every message is dropped silently** — `hub_client.init`
  succeeded but `check-sender` returns 404. Double-check the `telegram_user_id`
  you entered in the Hub Settings UI.
- **`/unlock <pin>` always returns `⛔ wrong PIN`** — PIN was not configured,
  or was configured for a different user. Re-set it via
  **Settings → Telegram → Telegram Bridge**.
- **`❌ failed` on every message** — either `CC_BINARY_PATH` is wrong (look
  for `spawn failed` in the stderr tail relayed to Telegram), or the `claude`
  CLI lost its subscription token (run `claude auth` to reauthenticate), or
  the active settings profile is blocking a tool your prompt is invoking.
- **`⏱ timed out` on simple prompts** — increase `CC_TIMEOUT` or check that the
  `claude` binary is not stuck on a permission prompt in interactive mode.

## Scope

- **Phase 1 (shipped):** env whitelist, text bot, cc subprocess, chunked
  replies, static status message, anti-abuse pacing.
- **Phase 2 (shipped):** Hub-backed whitelist via `check-sender`, PIN-gated
  `/unlock`, locked/unlocked `settings.json` profiles, per-chat `/new`
  session reset.
- **Phase 3 (deferred):** voice input (Whisper), request queue for bursts,
  `--output-format stream-json` progress parsing.
- **Phase 4 (deferred):** launchd LaunchAgent for auto-start on Mac boot.

## Tests

```bash
cd telegram_bot
source .venv/bin/activate
pytest tests/ -v
```

47 bot tests must pass (hub_client, state, state-hardening, unlock,
cc_runner, main whitelist gate, chunker).
