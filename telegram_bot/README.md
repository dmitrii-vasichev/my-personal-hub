# telegram_bot

Telegram bridge to Claude Code. A standalone Python process on the Mac receives
text messages from the bot owner's Telegram account, forwards the prompt to
`claude -p` under a deny-listed settings profile, and sends the reply back.

Phase 2 (shipped) adds Hub-backed sender whitelisting, PIN-gated `/unlock` for
destructive operations, locked/unlocked `settings.json` profiles, and per-chat
session management via `/new`.

Phase 3 (shipped) adds voice input (faster-whisper, CPU int8), a per-chat
request queue with backpressure, `/help` / `/status` / `/cancel` commands,
and opt-in stream-json progress parsing behind `TELEGRAM_PROGRESS_ENABLED`.

Phase 4 (shipped) adds `launchd` auto-start on the owner's Mac, crash-
resilient via `KeepAlive` with a 60-second throttle, and a two-file log
split (Python-rotated primary log + launchd-captured crash log). See
[Auto-start (launchd)](#auto-start-launchd) for the operator flow.

Phase 5 (shipped) adds per-chat project switching via `/project`. The bot
auto-discovers sibling projects under `CC_WORKDIR`'s parent (any folder
with a root `CLAUDE.md`), shows an inline keyboard, and routes each CC
invocation through the picked project's working directory and a
project-scoped session UUID. See [Project switching](#project-switching)
for the operator flow.

Source PRD: `docs/prd-telegram-claude-bridge.md`.
Phase 1 plan: `docs/plans/2026-04-17-telegram-claude-bridge-phase1.md` (local only).
Phase 2 plan: `docs/plans/2026-04-18-telegram-claude-bridge-phase2.md`.
Phase 3 plan: `docs/plans/2026-04-19-telegram-claude-bridge-phase3.md` (local only).
Phase 4 plan: `docs/plans/2026-04-19-telegram-claude-bridge-phase4.md` (local only).
Phase 5 plan: `docs/plans/2026-04-19-telegram-claude-bridge-phase5.md` (local only).

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
   - `TELEGRAM_PROGRESS_ENABLED` — **default `false`**. Grace-period kill-switch
     for intermediate status-message edits during CC runs (see
     [Progress parsing](#progress-parsing-opt-in)).
   - `WHISPER_MODEL_SIZE` — default `small` (~460 MB). Options: `tiny`, `base`,
     `small`, `medium`, `large-v3`. Only affects voice transcription quality /
     memory footprint.
   - `WHISPER_COMPUTE_TYPE` — default `int8` (CPU-friendly). Other options
     (`int8_float16`, `float16`, `float32`) are GPU-oriented and untested on CPU.
   - `PROJECT_DENY` — **optional** comma-separated list of sibling-project
     names to hide from `/project` even if they have a `CLAUDE.md`. Empty
     by default. See [Project switching](#project-switching).
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

## Auto-start (launchd)

For day-to-day use on the owner's Mac, the bot runs under a `launchd`
LaunchAgent so it comes up on login and restarts itself if it crashes.
Only one instance can poll the Telegram token at a time, so the
LaunchAgent and a shell-launched `python main.py` are mutually exclusive
— pick one.

### Install

Stop any shell-launched instance first (`Ctrl-C` or
`pkill -f 'telegram_bot/main.py'`), then:

```bash
./telegram_bot/launchd/install.sh
```

The script lints the plist with `plutil`, copies it to
`~/Library/LaunchAgents/`, loads it with `launchctl bootstrap`
(falling back to `launchctl load` on older macOS), and reports the
registration. A successful install ends with `OK  com.my-personal-hub.telegram-bot is registered`.

### Verify

```bash
launchctl print gui/$(id -u)/com.my-personal-hub.telegram-bot | grep -E '(state|pid|program)'
```

Expect `state = running` and a live PID. Then tail the Python log to
confirm the process actually came up:

```bash
tail -f ~/Library/Logs/com.my-personal-hub.telegram-bot.log
```

You should see the familiar `starting bot polling` line and a
successful `hub_client.init` against `HUB_API_URL`, same as a
shell-launched run.

### Logs

There are two log files now:

- **`~/Library/Logs/com.my-personal-hub.telegram-bot.log`** — primary
  Python log, everything `logger.info/warn/error` writes. Rotated
  automatically at 5 MB with 5 backups (25 MB cap). Read this first.
- **`~/Library/Logs/com.my-personal-hub.telegram-bot.launchd.log`** —
  captures whatever the Python process prints to stdout/stderr before
  the logger is configured (i.e. import-time crashes, `ValidationError`
  from pydantic on startup). Not rotated, but in practice stays tiny
  because a running bot does not print to stderr. Read only when the
  primary log is empty or the bot fails to start.

If `.launchd.log` ever grows (should not happen under normal use),
truncate it in place:

```bash
: > ~/Library/Logs/com.my-personal-hub.telegram-bot.launchd.log
```

### Restart

After editing `.env` or pulling new code into `telegram_bot/`:

```bash
launchctl kickstart -k gui/$(id -u)/com.my-personal-hub.telegram-bot
```

The `-k` flag stops the current process first (SIGTERM, then SIGKILL
after a few seconds), then relaunches — no unload/load cycle needed.

### Stop for development

To reclaim the Telegram token for a shell-launched `python main.py`:

```bash
# Fully remove the LaunchAgent:
./telegram_bot/launchd/uninstall.sh

# Or just unload it temporarily (plist stays in ~/Library/LaunchAgents/):
launchctl bootout gui/$(id -u)/com.my-personal-hub.telegram-bot
```

If you picked the second form, re-enable with
`launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.my-personal-hub.telegram-bot.plist`.

### Crash behaviour

The plist sets `KeepAlive={ SuccessfulExit: false }` and
`ThrottleInterval=60`. Any non-zero exit triggers a restart after ~60 s;
consecutive crashes are throttled to at most one restart per minute to
avoid respawn storms. If the bot stays crashed, check `.launchd.log`
first, then the primary log.

### Path assumptions

The shipped plist hardcodes absolute paths to this repo's location on
the owner's Mac (`/Users/dmitry.vasichev/Documents/my_projects/my-personal-hub/…`).
If you ever move the repo or clone it on a different user / machine,
edit `telegram_bot/launchd/com.my-personal-hub.telegram-bot.plist` by
hand — the four places that reference the repo root are flagged by
search for `/Users/dmitry.vasichev/`.

## Commands

- `/project` — pick which project CC should work against. See
  [Project switching](#project-switching) for the full flow.
- `/new` — reset the bot's conversation session for the **currently active
  project** in this chat. Other projects' sessions are left untouched, so
  switching back to them still resumes where you left off. The next message
  in the active project starts a fresh Claude Code session UUID; the
  previous `.jsonl` remains on disk but isn't resumed.
- `/unlock <pin>` — unlock destructive operations for 10 minutes in the
  current chat. Bot replies:
  - `🔓 unlocked for 10 min` on success.
  - `⛔ wrong PIN` on mismatch.
  - `⛔ usage: /unlock <pin>` if the argument is missing or malformed.
  - `⛔ too many attempts. Retry in ~N min.` when the backend has rate-limited
    you (5 failures / 10 min → 15-minute lockout). See
    [Unlock flow](#unlock-flow) for what unlocking changes.
- `/help` — list all bot commands.
- `/status` — show the currently active project, the CC session UUID for
  that project in this chat, the active job label (or `idle`), queue depth,
  and unlock expiry time (in the bot host's local timezone).
- `/cancel` — SIGINT the currently running CC subprocess. The reply notes
  the half-state caveat: migrations already run, commits already made, and
  other side effects are **not** rolled back. Bot replies:
  - `🟢 nothing to cancel` when no CC is running.
  - `🛑 stopped. Some actions may have already executed — check state manually.`
    on successful SIGINT.

## Project switching

Every chat has an **active project** — the working directory `claude -p`
runs in, and the key under which that chat's session UUID is stored. The
default active project is the one at `CC_WORKDIR` (usually
`my-personal-hub`). Pick a different one with `/project`.

### Discovery

On startup the bot scans the parent of `CC_WORKDIR`
(e.g. `~/Documents/my_projects/`) and picks up every immediate
subdirectory that has a root-level `CLAUDE.md` file. Folders listed in
`PROJECT_DENY` (`.env`) are skipped. The result is logged once per start:

```
discovered 6 projects: barber-booking, market-pulse-dashboard, mestnie, moving, my-personal-hub, portfolio-site
```

To make a folder visible to `/project`, add a minimal root `CLAUDE.md`
(even a one-liner is enough) and restart the bot:

```bash
launchctl kickstart -k gui/$(id -u)/com.my-personal-hub.telegram-bot
```

Discovery only runs at startup — adding or removing a project during a
run requires a restart.

### Switching

Send `/project` in the chat. The bot replies with an inline keyboard of
all discovered projects; the currently active one is marked with `✅`.
Tap a row to switch — the original message is edited in place to
`✅ switched to <name>` (no new chat-line noise). The next text or voice
message runs in the picked project.

### Per-chat, per-project sessions

The active project is **per-chat** — two different Telegram accounts
talking to the same bot have independent active projects. Within one
chat, each project has its own CC session UUID; switching between
projects preserves every project's conversation, so you can bounce
between `moving` and `my-personal-hub` without losing context on either.

`/new` resets only the active project's session. Other projects in the
same chat keep their state.

Stale state (e.g. you picked a project that was later renamed or denied)
falls back to the default project for the current message and logs a
warning. State is **not** silently rewritten — `/status` will show the
default project while internal state still points at the stale name, so
the user can re-pick explicitly via `/project`.

### Hiding a project

Add the project name to `PROJECT_DENY` in `.env`:

```
PROJECT_DENY=denver-urban-pulse,some-other-folder
```

Restart the bot. The listed names are removed from the keyboard even if
they still have `CLAUDE.md`.

### Security

Project switching does **not** relax any safety rails. Locked/unlocked
profiles are global (all projects share them), `Notes/Personal/**` stays
denied everywhere, and the PreToolUse hook (see
[Bash bypass closure](#bash-bypass-closure-pretooluse-hook)) runs for
every project.

## Voice input

Voice messages sent to the bot are transcribed locally with
[faster-whisper](https://github.com/SYSTRAN/faster-whisper) and then
treated exactly like a text prompt.

- First voice message downloads the `small` model (~460 MB) from Hugging
  Face to `~/.cache/huggingface/hub/`. Expect ~60 s of dead time on that
  first message; subsequent messages use the cached weights instantly.
- CPU inference is the default (`WHISPER_COMPUTE_TYPE=int8`). Metal
  acceleration is deferred — revisit if real-time factor exceeds ~3× on
  30-second notes.
- Language is auto-detected (`ru` / `en`). No forced language.
- The full transcript is **always** echoed back as `🎙 transcribed: …`
  before CC is invoked — regardless of transcript length. Short commands
  with misrecognitions are the dangerous case; you always see what CC
  will actually act on. Edit the transcript manually? Not yet — re-record
  or switch to text for now.
- Empty or silent recordings reply `⚠️ transcription produced empty text`.
- Whisper failures reply `⚠️ transcription failed`; the bot stays alive.

Knobs: `WHISPER_MODEL_SIZE`, `WHISPER_COMPUTE_TYPE` in `.env`.

## Queue and backpressure

Every text or voice message now dispatches through a per-chat async queue
so overlapping messages never spawn parallel `claude -p` processes racing
on the same session file.

- Capacity: 5 jobs in flight per chat (1 active + up to 4 waiting).
- Messages arriving while the queue has room reply with
  `⏳ in queue (pos N)` where `N` is the number of jobs ahead.
- Messages arriving at full capacity reply `⛔ queue full, try later` and
  are dropped (no retry, no auto-queue).
- `/cancel` drains the current job only — waiting jobs continue in order.

## Progress parsing (opt-in)

**Disabled by default. Do not enable until the bot has run ≥ 48 h of
clean traffic on the current bot token.**

When `TELEGRAM_PROGRESS_ENABLED=true`, the bot runs CC with
`--output-format stream-json --verbose` and edits the `🤔 thinking…`
status message on every `tool_use` event the CLI emits, throttled to a
minimum of 10 seconds between edits. Typical status lines:

- `📖 reading <filename>`
- `✏️ writing <filename>`
- `🔧 running: <command>` (truncated to 60 chars)
- `🔍 searching files` (Grep / Glob)
- `🧩 using skill: <subagent_type>`

If stream-json is malformed for a given invocation, the parser disables
itself silently and the status stays at `🤔 thinking…` until the final
transition. There is no spinner fallback — the PRD forbids it, because
timer-driven status edits are the anti-abuse signature that froze our
first bot on 2026-04-18.

Why opt-in: fresh Telegram bot tokens are watched closely by the
anti-abuse classifier. Frequent `editMessageText` on a fresh token is
one of the strongest signals. Let the token age on low-churn Phase 2
behaviour (single edit per invocation) before you flip the flag.

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
`~/Documents/Notes/Personal/**`, and a Bash-level hook (see below) closes
the `cat`/`head`/`awk` bypass that a tool-deny alone cannot cover.

Unlock state is **in-memory only**, keyed by `chat_id`. Restarting the bot
clears all unlocks; every chat must re-run `/unlock <pin>` to restore
destructive privileges.

### Three-tier personal-data model

The bot distinguishes three tiers of personal data, each with a different
reachability rule:

| Tier | Location | Bot access | Examples |
|------|----------|------------|----------|
| 1 — sensitive | `~/Documents/Notes/Personal/` | Never (both profiles deny file tools + Bash hook blocks the bypass) | SSN, bank account numbers, passport scans, tax data |
| 2 — mobile | `~/Documents/Notes/Personal-mobile/` | Only after `/unlock` + PIN | Car VIN / plates, insurance policy #, phone plan, medical card # |
| 3 — project | `~/Documents/my_projects/<project>/` | Always (governed by per-project `CLAUDE.md` and the global safety rails) | Project notes, lease details, move-in paperwork |

The Personal-mobile folder is a deliberately curated subset — anything you
would be willing to read aloud in a cafe. See
`~/Documents/Notes/Personal-mobile/README.md` for the full policy.

### Bash bypass closure (PreToolUse hook)

`profiles/hooks/block-paths.py` is a PreToolUse hook attached to the Bash
tool in both profiles. Before every Bash command, it reads the command
string from stdin and rejects (exit code 2) any command that references
`Notes/Personal/` — the `locked` profile additionally rejects references
to `Notes/Personal-mobile/`. This closes the hole where a skill following
the global CLAUDE.md rule ("check `Personal/` before asking") would fall
back from a denied `Read` tool call to a permitted `Bash(cat ...)` call
and silently exfiltrate data into the chat.

The hook uses a literal substring matcher (`Notes/<name>` with identifier
boundaries), which is not adversarial-hardened against deliberate
obfuscation (glob expansion, encoded strings, symlinks) but covers the
realistic threat model of well-behaved skills issuing literal paths. True
defense-in-depth would require subprocess sandboxing, out of scope.

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
per-(chat, project) UUID in `telegram_bot/.state.json` and passes it to
`claude -p`. If the session's `.jsonl` file already exists under
`~/.claude/projects/<encoded-workdir>/<uuid>.jsonl`, the bot switches to
`--resume` automatically (CC rejects `--session-id` for in-use UUIDs).

`.state.json` schema::

    {
        "chats": {
            "<chat_id>": {
                "active_project": "my-personal-hub",
                "sessions": {
                    "my-personal-hub": "<uuid>",
                    "market-pulse-dashboard": "<uuid>"
                }
            }
        }
    }

Phase 2–4 state files (`{"sessions": {<chat_id>: <uuid>}}`) auto-migrate
in place on the first read after upgrade — no manual steps required.

`/new` rotates the UUID for the **active project** in the current chat;
other projects keep their UUIDs. The previous `.jsonl` is left on disk
untouched but is no longer referenced.

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
- **Phase 3 (shipped):** voice input (faster-whisper, CPU int8, lazy-loaded),
  per-chat request queue with backpressure, `/help` / `/status` / `/cancel`
  commands, opt-in `--output-format stream-json` progress parsing behind
  `TELEGRAM_PROGRESS_ENABLED`.
- **Phase 4 (shipped):** `launchd` LaunchAgent for auto-start on owner
  login, crash-resilient via `KeepAlive` with a 60-second restart
  throttle, split stdout/stderr to a separate `*.launchd.log` so the
  Python `RotatingFileHandler` stays authoritative on the primary log,
  `install.sh` / `uninstall.sh` wrappers around `launchctl bootstrap` /
  `bootout`. See [Auto-start (launchd)](#auto-start-launchd) above.
  Metal acceleration for faster-whisper is a follow-up candidate if CPU
  int8 proves slow.
- **Phase 5 (shipped):** per-chat project switching via `/project`.
  Auto-discovery of sibling projects (`CC_WORKDIR`'s parent, filtered to
  folders with a root `CLAUDE.md` and minus `PROJECT_DENY`), inline
  keyboard picker, per-(chat, project) session UUIDs with automatic
  migration from the Phase 2–4 state format. See
  [Project switching](#project-switching) above.

## Tests

```bash
cd telegram_bot
source .venv/bin/activate
pytest tests/ -v
```

163 bot tests must pass: hub_client, state (per-(chat, project) + legacy
migration), state-hardening, unlock, cc_runner (both non-streaming and
streaming variants), request_queue, progress, voice, chunker, projects
(discovery + deny-list), main (whitelist gate + queue routing + /help,
/status, /cancel, /project + voice handler + progress-flag routing +
active-project routing).

The `voice_real` marker gates an optional integration test that actually
loads the Whisper model and transcribes a short clip — not part of the
default suite. Run manually during smoke with `pytest -m voice_real`.
