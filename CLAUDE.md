# My Personal Hub

## Stack
- Frontend: Next.js 16, React 19, TypeScript, Tailwind 4, shadcn, Recharts
- Backend: FastAPI, SQLAlchemy (async), PostgreSQL, Alembic
- Deploy: Vercel (frontend), Railway (backend)
- AI: OpenAI, Anthropic, Google Generative AI
- Integrations: Telegram (Telethon + Bot API), Garmin Connect, Google Calendar, Google Drive, Gmail

## Current Status

- **Mode:** Phase 1 of Telegram→CC bridge shipped to `main` (`f3bc297`); ready to start `/dev plan` for Phase 2 in a fresh session.
- **Feature:** Telegram to Claude Code bridge — Phase 2 (Auth + PIN + locked/unlocked CC profiles + session mgmt).
- **PRD:** `docs/prd-telegram-claude-bridge.md` (Phase 2 covers FR-5..FR-14; Phase 3/4 out of scope).
- **Branch:** `main` (up to date with `origin/main`). Phase 1 squash landed as `f3bc297 feat: telegram→CC bridge phase 1 — text bot with whitelist and cc subprocess`; the 14 task/fix commits on `feature/telegram-bridge-phase1` have been collapsed and the branch deleted locally.
- **Phase 1 outcome (working now):** `telegram_bot/` package with pydantic-settings config, rotating logger at `~/Library/Logs/com.my-personal-hub.telegram-bot.log`, env-based whitelist (`WHITELIST_TG_USER_ID`), UUID5(`"tg-default"`) session, automatic `--resume` when the `.jsonl` session file already exists on disk, spinner status (2s cadence), 4000-char chunker with paragraph/code-fence boundaries, CC error/timeout/spawn-failure relay, 3/3 pytest green, live Telegram smoke verified.
- **Phase 2 scope to plan:** (a) 4 Hub endpoints — `POST /api/telegram/auth/check-sender`, `POST /api/telegram/auth/verify-pin`, `PUT /api/users/me/telegram-pin`, `PUT /api/users/me/telegram-user-id` — with Alembic migration for `users.telegram_user_id` and `users.telegram_pin_hash` (bcrypt); (b) Settings UI subsection "Telegram Bridge" with TG user-id + PIN inputs and configured-status indicator; (c) bot changes — replace env whitelist with `check-sender` httpx call, `/unlock <pin>` command with in-memory `unlock_until` (10 min), `/new` command with `uuid.uuid4()` + per-chat state persisted to `telegram_bot/.state.json`; (d) two `settings.json` profiles in `telegram_bot/profiles/` — `locked.settings.json` (denies `git push*`, `rm -rf*`, `sudo*`, `curl*`, `wget*`, and all tool access under `~/Documents/Notes/Personal/**`) and `unlocked.settings.json` (same plus `git push*` and `rm*` within the project allowed); `cc_runner` passes `--settings <profile-path>` based on current unlock state.
- **Key constraints carried from Phase 1:** subscription-based `claude -p` only (no Anthropic API); `Notes/Personal/**` denied in both locked and unlocked profiles; unlock state in-memory only (restart → re-unlock); CC CLI requires UUID for `--session-id` and rejects in-use UUIDs — `cc_runner._session_file()` probes `~/.claude/projects/<encoded-workdir>/<uuid>.jsonl` and switches to `--resume`, and the encoding is `re.sub(r"[^a-zA-Z0-9-]", "-", abs_path)`; bot on Mac, Hub on Railway (`https://backend-api-production-1967.up.railway.app`); single-tenant.
- **Out of scope for Phase 2:** voice (Phase 3), queue (Phase 3), stream-json progress parsing (Phase 3), launchd LaunchAgent (Phase 4).
- **Previous initiative (closed):** Planner↔Hub Phase 2 fully shipped on `main` (`af9a094` + follow-ups).
- **Next:** fresh session → read PRD + `telegram_bot/README.md` + this status → `/dev plan telegram-bridge-phase2` → discovery → approved PRD-diff (if any) + `docs/plans/2026-04-XX-telegram-claude-bridge-phase2.md` → `/dev build` on a new `feature/telegram-bridge-phase2` branch.
