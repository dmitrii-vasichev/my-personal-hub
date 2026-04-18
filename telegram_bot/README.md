# telegram_bot

Phase 1 foundation of the Telegram bridge to Claude Code. A standalone Python
process on the Mac receives text messages from a single whitelisted Telegram
user, forwards the prompt to `claude -p` with a fixed default session, and
sends the reply back. No Hub integration, no auth flow, no voice, no queue,
no launchd — those land in Phases 2–4.

Source PRD: `docs/prd-telegram-claude-bridge.md`.
Phase 1 plan: `docs/plans/2026-04-17-telegram-claude-bridge-phase1.md` (local only).

## Prerequisites

- Python 3.11+ (3.12 tested).
- `claude` CLI installed and authenticated (subscription). Confirm with `claude --version`.
- A Telegram account for the bot owner (you).

## Setup

1. **Create the bot** — talk to [@BotFather](https://t.me/BotFather),
   `/newbot`, copy the token.
2. **Get your Telegram user id** — send any message to
   [@userinfobot](https://t.me/userinfobot), copy the numeric `Id` it replies with.
3. **Configure `.env`**:
   ```bash
   cp telegram_bot/.env.example telegram_bot/.env
   ```
   Fill in:
   - `TELEGRAM_BOT_TOKEN` — from step 1.
   - `WHITELIST_TG_USER_ID` — from step 2.
   - `CC_BINARY_PATH` — run `which claude` and paste the absolute path.
   - `CC_WORKDIR` — absolute path to this repo's root.
   - `CC_TIMEOUT` — default 300s is fine.
   - `LOG_LEVEL` — `INFO` by default; `DEBUG` to see drop-events for
     non-whitelisted updates.
4. **Install deps**:
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

Expected on start: `starting bot polling session_default=<uuid>` in stderr and
in `~/Library/Logs/com.my-personal-hub.telegram-bot.log`.

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

`--session-id` on the Claude CLI requires a valid UUID, so the bot maps the
logical label `"tg-default"` to a deterministic UUID
(`uuid5(NAMESPACE_DNS, "tg-default")`). Every text message in Phase 1 uses that
same UUID, giving a single continuous CC conversation across bot restarts.
Named / fresh sessions (`/new`) land in Phase 2.

## Troubleshooting

- **Bot silent after sending text** — check
  `~/Library/Logs/com.my-personal-hub.telegram-bot.log`. A `drop update from
  non-whitelisted id=…` line means `WHITELIST_TG_USER_ID` in `.env` does not
  match the sender.
- **`ValidationError` on start** — one of the required env vars is missing or
  malformed. The error message lists which ones.
- **`❌ failed` on every message** — either `CC_BINARY_PATH` is wrong (look
  for `spawn failed` in the stderr tail relayed to Telegram), or the `claude`
  CLI lost its subscription token (run `claude auth` to reauthenticate).
- **`⏱ timed out` on simple prompts** — increase `CC_TIMEOUT` or check that the
  `claude` binary is not stuck on a permission prompt in interactive mode.

## Scope

Phase 1 is a manual-run foundation. No launchd, no Hub auth, no PIN/unlock,
no voice, no queue. Do not leave the process running unattended with an
unlocked laptop — Phase 2 adds the `settings.json` deny-list profiles that
block destructive operations.

## Tests

```bash
cd telegram_bot
source .venv/bin/activate
pytest tests/ -v
```

3 chunker tests must pass.
