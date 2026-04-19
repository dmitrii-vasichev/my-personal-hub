# My Personal Hub

## Stack
- Frontend: Next.js 16, React 19, TypeScript, Tailwind 4, shadcn, Recharts
- Backend: FastAPI, SQLAlchemy (async), PostgreSQL, Alembic
- Deploy: Vercel (frontend), Railway (backend)
- AI: OpenAI, Anthropic, Google Generative AI
- Integrations: Telegram (Telethon + Bot API), Garmin Connect, Google Calendar, Google Drive, Gmail

## Current Status

- **Mode:** Phase 2 of Telegram→CC bridge **build complete**; Task 10 (E2E smoke + squash-merge) is the only remaining step. A fresh session should pick up `/dev ship telegram-bridge-phase2` — there are no more implementation tasks, only live verification and the merge.
- **Feature:** Telegram to Claude Code bridge — Phase 2 (Auth + PIN + locked/unlocked CC profiles + session mgmt).
- **Branch:** `feature/telegram-bridge-phase2` — all Phase 2 commits land here. Ready for squash-merge into `main` after Task 10 E2E passes.
- **PRD:** `docs/prd-telegram-claude-bridge.md` (updated 2026-04-18 with Phase 2 delta — hybrid `get_current_user` auth via `api_tokens`, single "Telegram" tab with "Telegram Pulse" + "Telegram Bridge" sections, `verify-pin` rate-limit, `rm*` / `rm -rf*` split in profiles, "Pre-existing infrastructure" section).
- **Plan:** `docs/plans/2026-04-18-telegram-claude-bridge-phase2.md` — 11 tasks (0 spike → 10 e2e merge). 10 of 11 shipped.
- **Tasks shipped (0–9):**
  - **Task 0 — spike.** Confirmed `claude -p --settings <file>` honours a `settings.json` deny-list before any profile-switching code was written.
  - **Task 1 — backend schemas + PIN rate-limit util.** Request/response models in `app/api/telegram_bridge/schemas.py` and an in-memory 5-failures/10-min → 15-min-lockout rate-limit helper. 5 tests.
  - **Task 2 — backend endpoints.** `POST /api/telegram/auth/check-sender`, `POST /api/telegram/auth/verify-pin`, `PATCH /api/users/me/telegram-user-id`, `PUT /api/users/me/telegram-pin`, `DELETE /api/users/me/telegram-pin`. `UserResponse` extended with `telegram_user_id` / `telegram_pin_configured`; a `user_to_response` shim was wired through auth/me and admin endpoints. 20 backend tests.
  - **Task 3 — `telegram_bot/hub_client.py`.** httpx async client with Bearer `phub_…` auth, `PinLockedOut` exception for 429, retry-once on transient `ConnectError`. 11 tests.
  - **Task 4 — `telegram_bot/state.py` + `/new`.** Per-chat session-UUID store in `.state.json`, hardened against manual edits; `/new` rotates the UUID for the current chat. 7 tests.
  - **Task 5 — `/unlock` command.** In-memory unlock state keyed by `chat_id`, 10-min expiry; `hub_client.init` / `shutdown` wired via PTB `post_init` / `post_shutdown`. 11 tests.
  - **Task 6 — settings.json profiles.** `telegram_bot/profiles/locked.settings.json` + `unlocked.settings.json`, `cc_runner.run_cc(settings_path=...)`, `_profile_for(chat_id)` picker in `main.py`. 7 tests.
  - **Task 7 — Hub-backed whitelist.** Env whitelist replaced by `hub_client.check_sender` with 60s `chat_data` cache, env fallback only on httpx transport exceptions; all 3 handlers (`on_text`, `/new`, `/unlock`) gated. 8 tests.
  - **Task 8 — frontend.** "Telegram Bridge" section added to the existing Telegram Settings tab, "Telegram Pulse" renamed, new hooks + types, `User` interface extended with `telegram_user_id` / `telegram_pin_configured`.
  - **Task 9 — docs.** `telegram_bot/README.md` rewritten for Phase 2 setup flow (API token mint, UI config, env vars, new commands, unlock flow, scope); this Current Status block.
- **Task 10 remaining (E2E + merge):** live smoke against the deployed Hub + the running bot — covers AC-3, AC-4, AC-6, AC-7, AC-9 from the PRD. After green, flip Current Status to "Phase 2 shipped on main", squash-merge `feature/telegram-bridge-phase2` → `main`, delete the branch.
- **Pre-merge setup (Task 10 owner):**
  - Deploy backend to Railway (push to `main` triggers); wait for the deploy to go green.
  - Deploy frontend to Vercel; hard-reload **Settings → Telegram**.
  - In **Settings → API Tokens**, mint a `telegram-bridge` token and paste the `phub_…` value into `telegram_bot/.env` as `HUB_API_TOKEN`.
  - Set `HUB_API_URL=https://backend-api-production-1967.up.railway.app` in `telegram_bot/.env`.
  - In **Settings → Telegram → Telegram Bridge**, set your Telegram numeric id and a 4–8 digit PIN.
  - Start the bot: `cd telegram_bot && source .venv/bin/activate && python main.py`.
- **Key constraints carried from Phase 1:** subscription-based `claude -p` only (no Anthropic API); `Notes/Personal/**` denied in both locked and unlocked profiles; unlock state in-memory only (restart → re-unlock); CC CLI requires UUID for `--session-id` and rejects in-use UUIDs — `cc_runner._session_file()` probes `~/.claude/projects/<encoded-workdir>/<uuid>.jsonl` and switches to `--resume`, encoding is `re.sub(r"[^a-zA-Z0-9-]", "-", abs_path)`; bot on Mac, Hub on Railway (`https://backend-api-production-1967.up.railway.app`); single-tenant; NFR "Anti-abuse hygiene" in force (no timer spinners, ≥ 10s between consecutive status edits, ≥ 0.5s between chunks).
- **Out of scope for Phase 2:** voice (Phase 3), queue (Phase 3), stream-json progress parsing (Phase 3), launchd LaunchAgent (Phase 4).
- **Test totals at end of Task 9:** bot 47 tests green (11 hub_client + 5 state + 2 state-hardening parametrized + 11 unlock + 7 cc_runner + 8 main whitelist + 3 chunker); backend ~822 tests green with 9 pre-existing failures unrelated to Phase 2; frontend build green.
- **Telegram account context (tangential):** the user's original RU-number Telegram account was session-cascade-terminated during the 2026-04-18 anti-abuse incident and has not yet been recovered (US location + RU SIM makes SMS/voice verification hard). Development continues with a **different, working TG account**; `.env` already holds the matching token. Phase 2 `check-sender` is wired against whatever `users.telegram_user_id` the owner configures in Settings UI — no hardcoded account.
- **Previous initiative (closed):** Planner↔Hub Phase 2 fully shipped on `main` (`af9a094` + follow-ups).
