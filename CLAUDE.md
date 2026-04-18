# My Personal Hub

## Stack
- Frontend: Next.js 16, React 19, TypeScript, Tailwind 4, shadcn, Recharts
- Backend: FastAPI, SQLAlchemy (async), PostgreSQL, Alembic
- Deploy: Vercel (frontend), Railway (backend)
- AI: OpenAI, Anthropic, Google Generative AI
- Integrations: Telegram (Telethon + Bot API), Garmin Connect, Google Calendar, Google Drive, Gmail

## Current Status

- **Mode:** Phase 2 of Telegram→CC bridge **planned** (docs-only: plan + PRD update). Ready to start `/dev build telegram-bridge-phase2` in a fresh session; this current session ends with the plan document and PRD delta committed — no implementation code touched.
- **Feature:** Telegram to Claude Code bridge — Phase 2 (Auth + PIN + locked/unlocked CC profiles + session mgmt).
- **PRD:** `docs/prd-telegram-claude-bridge.md` — updated 2026-04-18 with Phase 2 delta (hybrid `get_current_user` auth via existing `api_tokens`, single-tab UI with renamed "Telegram Pulse" + new "Telegram Bridge" sections, `verify-pin` rate-limit, clarified `rm*` / `rm -rf*` split in profiles, new "Pre-existing infrastructure" section). NFR "Anti-abuse hygiene" in force for all build work (no timer spinners, ≥ 10s between edits, ≥ 0.5s between chunks).
- **Plan:** `docs/plans/2026-04-18-telegram-claude-bridge-phase2.md` — 11 tasks (0 spike → 10 e2e merge) with file paths, code sketches, tests, and verification commands. Source of truth for the build session.
- **Branch:** `main` (up to date with `origin/main`). Docs commits for this planning session to be made on `chore/phase2-plan` and merged back.
- **Phase 1 outcome (baseline):** `telegram_bot/` package with pydantic-settings config, rotating logger at `~/Library/Logs/com.my-personal-hub.telegram-bot.log`, env-based whitelist (`WHITELIST_TG_USER_ID`), UUID5(`"tg-default"`) session with automatic `--resume` when the `.jsonl` file already exists on disk, static (non-animated) `🤔 thinking…` status edited exactly once per invocation, paced chunked replies (~0.7s), 4000-char chunker on paragraph/code-fence boundaries, CC error/timeout/spawn-failure relay, 3/3 pytest green. Live Telegram smoke green on a new bot token + different TG account (old bot `dv_cc_bridge_bot` was frozen 2026-04-18, see reference memory).
- **Key Phase 2 decisions locked in plan:** (Q1) backend in-memory rate-limit on `verify-pin` — 5 failures / 10 min / user → 15 min lockout; (Q2) bot↔backend auth via existing `api_tokens` `phub_…` flow, no new shared secret; (Q4) one Settings tab "Telegram" with two sections ("Telegram Pulse" existing-renamed + "Telegram Bridge" new); (Q6a) hardcoded absolute `/Users/dmitry.vasichev/Documents/Notes/Personal/**` in profile JSONs; (Q6b) `Bash(rm -rf*)` denied in both profiles, `Bash(rm*)` without `-rf` allowed only in unlocked; (Q7) Task 0 spike verifies `claude -p --settings <file>` before any profile-switching code.
- **Phase 2 scope removed after code review:** Alembic migration for `users.telegram_user_id` / `users.telegram_pin_hash` — already shipped in `6e6fee7795cb` (Phase 1 Task 1). API-token Bearer auth mechanism — already shipped as `api_tokens` table + `phub_…` scheme + hybrid `get_current_user`.
- **Key constraints carried from Phase 1:** subscription-based `claude -p` only (no Anthropic API); `Notes/Personal/**` denied in both locked and unlocked profiles; unlock state in-memory only (restart → re-unlock); CC CLI requires UUID for `--session-id` and rejects in-use UUIDs — `cc_runner._session_file()` probes `~/.claude/projects/<encoded-workdir>/<uuid>.jsonl` and switches to `--resume`, encoding is `re.sub(r"[^a-zA-Z0-9-]", "-", abs_path)`; bot on Mac, Hub on Railway (`https://backend-api-production-1967.up.railway.app`); single-tenant.
- **Out of scope for Phase 2:** voice (Phase 3), queue (Phase 3), stream-json progress parsing (Phase 3), launchd LaunchAgent (Phase 4).
- **Telegram account context (tangential):** the user's original RU-number Telegram account was session-cascade-terminated during the 2026-04-18 anti-abuse incident and has not yet been recovered (US location + RU SIM makes SMS/voice verification hard). Development continues with a **different, working TG account**; `.env` already holds the matching token and `WHITELIST_TG_USER_ID`. Phase 2 `check-sender` is wired against whatever `users.telegram_user_id` the owner configures in Settings UI — no hardcoded account.
- **Previous initiative (closed):** Planner↔Hub Phase 2 fully shipped on `main` (`af9a094` + follow-ups).
- **Next:** fresh session → read `docs/plans/2026-04-18-telegram-claude-bridge-phase2.md` and updated PRD → `/dev build telegram-bridge-phase2` → Task 0 spike first → then Tasks 1–10 in order. Build session opens its own feature branch per logical unit.
