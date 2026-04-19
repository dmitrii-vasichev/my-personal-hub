# My Personal Hub

## Stack
- Frontend: Next.js 16, React 19, TypeScript, Tailwind 4, shadcn, Recharts
- Backend: FastAPI, SQLAlchemy (async), PostgreSQL, Alembic
- Deploy: Vercel (frontend), Railway (backend)
- AI: OpenAI, Anthropic, Google Generative AI
- Integrations: Telegram (Telethon + Bot API), Garmin Connect, Google Calendar, Google Drive, Gmail

## Current Status

- **Mode:** Phase 2 of Telegram→CC bridge **shipped and E2E-verified on `main`** (feat `378c854` + path-syntax fix `c5a613f`, 2026-04-19). All AC scenarios (AC-3/4/6/7/9) passed on live bot + deployed Hub. No blocking code work remains.
- **Feature (closed):** Telegram to Claude Code bridge — Phase 2 (Hub-backed whitelist, PIN-gated `/unlock`, locked/unlocked `claude -p --settings` profiles, per-chat `/new` session UUIDs, Settings → Telegram Bridge UI).
- **Branch:** `main` (feature branch `feature/telegram-bridge-phase2` deleted after merge).
- **PRD:** `docs/prd-telegram-claude-bridge.md` (updated 2026-04-18 with Phase 2 delta).
- **Plan:** `docs/plans/2026-04-18-telegram-claude-bridge-phase2.md` — 11 tasks, all 11 shipped (Task 10 = this merge; live E2E deferred to owner's hands).
- **Phase 2 outcome summary:**
  - Backend: `POST /api/telegram/auth/check-sender`, `POST /api/telegram/auth/verify-pin` + `PUT /api/users/me/telegram-pin` + `PUT /api/users/me/telegram-user-id`, all via hybrid `get_current_user` (JWT + `phub_…`) + `restrict_demo`. In-memory rate limiter: 5 failures / 10 min → 15-min lockout. `UserResponse` extended with `telegram_user_id` + `telegram_pin_configured` (hash never serialised).
  - Bot: `telegram_bot/hub_client.py` (httpx, Bearer, `PinLockedOut`), `telegram_bot/state.py` (per-chat uuid4 in `.state.json`, schema-hardened), `telegram_bot/unlock.py` (10-min in-memory per-chat window), `telegram_bot/profiles/{locked,unlocked}.settings.json` (locked denies `git push*`, `rm -rf*`, `rm*`, `sudo*`, `curl*`, `wget*`, `Notes/Personal/**`; unlocked drops `git push*` and `rm*`, keeps `rm -rf*` and `Personal/**`). `cc_runner.run_cc(settings_path=...)`; `_profile_for(chat_id)` picks profile via `unlock.is_unlocked`. `_is_whitelisted` gate on all 3 handlers with 60s `chat_data` cache + env fallback only on httpx transport exceptions (404 is authoritative).
  - Frontend: Settings → Telegram tab has two sections — existing "Telegram Pulse" (renamed) + new "Telegram Bridge" with status badge, user-id + PIN inputs (regex-validated, Set/Rotate label swap), a11y attrs.
  - Tests: backend `822 passed / 9 pre-existing failures unrelated`; bot `47 passed` (was 3 in Phase 1); frontend build green.
- **Live E2E outcome (2026-04-19):** AC-3 rate-limit (5 wrong PINs → 15-min lockout) ✅, AC-4 profile switching (locked denies `git push`/`rm`; unlocked allows them; `rm -rf` denied in both) ✅, AC-6 non-whitelisted silent drop after ~60s cache invalidation ✅, AC-7 `/new` resets Claude Code session context ✅, AC-9 `Notes/Personal/**` denied in both profiles ✅. One bug surfaced and fixed mid-smoke (`c5a613f`): `claude -p --settings` silently ignored `Read/Edit/Write/Glob/Grep(/abs/path/**)` patterns — only `~/...` tilde (or `//abs/...` doubled slash) forms are honoured by the tool-path matcher. Task 0 spike had only validated `Bash(cmd*)` style; file-tool path syntax was assumed and not tested. Profile JSONs corrected to tilde form; README deny-list description updated with the requirement.
- **Key constraints (still in force going forward):** subscription-based `claude -p` only (no Anthropic API); `Notes/Personal/**` denied in both profiles; unlock state in-memory only (restart → re-unlock); CC CLI requires UUID for `--session-id` and rejects in-use UUIDs — `cc_runner._session_file()` probes `~/.claude/projects/<encoded-workdir>/<uuid>.jsonl` and switches to `--resume`; bot on Mac, Hub on Railway; single-tenant; NFR "Anti-abuse hygiene" in force (no timer spinners, ≥ 10s between status edits, ≥ 0.5s between chunks).
- **Deferred to later phases:** voice input (Phase 3), request queue (Phase 3), stream-json progress parsing (Phase 3), launchd LaunchAgent auto-start (Phase 4).
- **Telegram account context (tangential):** the user's original RU-number Telegram account was session-cascade-terminated during the 2026-04-18 anti-abuse incident and has not yet been recovered (US location + RU SIM makes SMS/voice verification hard). Development continues with a **different, working TG account**; `.env` already holds the matching bot token. Phase 2 `check-sender` is wired against whatever `users.telegram_user_id` the owner configures in Settings UI — no hardcoded account.
- **Next:** no blocking code work. When ready, open `/dev plan telegram-bridge-phase3` for voice + queue + stream-json progress.
- **Previous initiatives (closed):** Planner↔Hub Phase 2 (`af9a094` + follow-ups); Telegram→CC bridge Phase 1 (`f3bc297` + follow-ups).
