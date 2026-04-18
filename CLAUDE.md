# My Personal Hub

## Stack
- Frontend: Next.js 16, React 19, TypeScript, Tailwind 4, shadcn, Recharts
- Backend: FastAPI, SQLAlchemy (async), PostgreSQL, Alembic
- Deploy: Vercel (frontend), Railway (backend)
- AI: OpenAI, Anthropic, Google Generative AI
- Integrations: Telegram (Telethon + Bot API), Garmin Connect, Google Calendar, Google Drive, Gmail

## Current Status

- **Mode:** Phase 1 of Telegram→CC bridge code-complete on `feature/telegram-bridge-phase1`; pending live end-to-end smoke before squash-merge to `main`.
- **Feature:** Telegram to Claude Code bridge (Phase 1 — foundation).
- **PRD:** `docs/prd-telegram-claude-bridge.md` (clarified in `002e2fa` that `--session-id` requires UUID; logical names like `"tg-default"` live only in logs).
- **Plan:** `docs/plans/2026-04-17-telegram-claude-bridge-phase1.md` (local only, `docs/plans/` is gitignored).
- **Branch:** `feature/telegram-bridge-phase1` — 9 task commits (`f4277aa` → `f43258c`) plus the PRD clarification.
- **Phase 1 scope shipped:** `telegram_bot/` package with pydantic-settings config, rotating file logger at `~/Library/Logs/com.my-personal-hub.telegram-bot.log`, async `python-telegram-bot` v21 handler, env-based whitelist (`WHITELIST_TG_USER_ID`), `claude -p --session-id <uuid>` subprocess (UUID5 of `"tg-default"` for continuity across restarts), spinner status message (2s cadence), 4000-char chunker with paragraph/code-fence boundaries (3 pytest cases green), CC error/timeout/spawn-failure relay. Manual run via `python main.py`; no launchd, no Hub endpoints, no PIN, no voice, no queue.
- **Full feature phasing:** Phase 1 Foundation ✓ → Phase 2 Auth+PIN+profiles (4 Hub endpoints, Settings UI, `/unlock`, `/new` with UUID4 in `.state.json`, `locked`/`unlocked` `settings.json` profiles) → Phase 3 Voice+Queue+Progress → Phase 4 Productionise (launchd LaunchAgent, setup guide).
- **Key agreed decisions:** subscription-based `claude -p` (no Anthropic API); `Notes/Personal/**` denied in both locked/unlocked profiles; unlock state in-memory only; bot single-tenant; bot hosts on Mac, Hub stays on Railway.
- **Previous initiative (closed):** Planner↔Hub Phase 2 fully shipped on `main` (`af9a094` + follow-ups). Backend URL: `https://backend-api-production-1967.up.railway.app`.
- **Next:** live end-to-end smoke (6-bullet checklist in `telegram_bot/README.md` Run section). On pass → squash-merge Phase 1 to `main`. Then `/dev plan` for Phase 2.
