# My Personal Hub

## Stack
- Frontend: Next.js 16, React 19, TypeScript, Tailwind 4, shadcn, Recharts
- Backend: FastAPI, SQLAlchemy (async), PostgreSQL, Alembic
- Deploy: Vercel (frontend), Railway (backend)
- AI: OpenAI, Anthropic, Google Generative AI
- Integrations: Telegram (Telethon + Bot API), Garmin Connect, Google Calendar, Google Drive, Gmail

## Current Status

- **Mode:** `/dev build` → **Tasks 0–3 landed on `feature/telegram-bridge-phase3`; Task 4 in progress** (docs + regression green, awaiting owner-driven live smoke + merge).
- **Feature (open):** Telegram to Claude Code bridge — Phase 3 (voice input via faster-whisper, per-chat request queue with backpressure, stream-json progress parsing behind `TELEGRAM_PROGRESS_ENABLED` grace flag, `/status`/`/cancel`/`/help` commands).
- **Branch:** `feature/telegram-bridge-phase3`.
- **Phase 3 commits on branch (not yet merged):**
  - `f4c0438` — Task 1: per-chat request queue + `/status` / `/cancel` / `/help` + `on_spawn` on `run_cc`.
  - `031841d` — Task 2: stream-json progress parsing behind `TELEGRAM_PROGRESS_ENABLED` (default `false`).
  - `9c0e93e` — Task 3: voice input via faster-whisper (CPU int8, lazy-loaded).
- **PRD:** `docs/prd-telegram-claude-bridge.md` (patched 2026-04-19 — removed spinner fallback, always-on voice-preview policy, `/cancel` half-state caveat, grace-flag gating on progress edits).
- **Plan:** `docs/plans/2026-04-19-telegram-claude-bridge-phase3.md` (local only). Spike results recorded there.
- **Task 0 spike (2026-04-19, CC CLI 2.1.114):** 🟢 GREEN. 4/4 probes emit parseable stream-json. Critical correction vs. plan draft: `tool_use` and `text` are nested content blocks inside `assistant.message.content[]`, not top-level events. `--verbose` is mandatory alongside `--output-format stream-json` when using `-p`. Terminal event `{"type":"result"}` carries the canonical plain-text reply in `result.result`. Progress parser + `run_cc_streaming` wired accordingly.
- **Bot test suite:** 112 pass (was 47 at Phase 2 close). Breakdown: 47 Phase 2 baseline + 7 queue + 2 `on_spawn` + 9 handler (/status, /cancel, /help + queue routing) + 27 progress parser + 6 streaming cc_runner + 4 progress-flag routing + 6 voice unit + 4 voice handler.
- **Queue semantics:** `MAX_INFLIGHT = 5` counts active + waiting. AC-8 behaviour: msg 1 runs, msgs 2–5 reply `⏳ in queue (pos 1..4)`, msg 6+ replies `⛔ queue full, try later` and is dropped. The plan's original math (qsize-only) was corrected during Task 1.
- **Voice handler order of operations:** whitelist gate → enqueue (queue-full check runs BEFORE download/transcribe, so a saturated chat doesn't waste Whisper cycles) → download `.ogg` → transcribe via faster-whisper → always-echo `🎙 transcribed: <transcript>` → `🤔 thinking…` → `_run_cc_with_optional_progress` → `_render_result`.
- **Anti-abuse guard rails for Phase 3** (the 2026-04-18 freeze is still load-bearing context): no spinner fallback ever; ≥10s hard-coded minimum between status edits; `TELEGRAM_PROGRESS_ENABLED` default `false` so default behaviour matches Phase 2; `stdin=DEVNULL` on the streaming subprocess to suppress the CLI's "no stdin data in 3s" warning; progress parser auto-disables on first JSONDecodeError for the remainder of that invocation.
- **Pending for Task 4 completion:** live smoke of AC-2 (voice end-to-end), AC-8 (queue backpressure), `/cancel` smoke (SIGINT cleans up), progress-flag flip smoke; backend `pytest` regression (expected: 9 pre-existing unrelated fails); frontend `npm run build`; then owner-approved squash-merge and CLAUDE.md flip to "Phase 3 shipped".
- **Key constraints (still in force):** subscription-based `claude -p` only (no Anthropic API); `Notes/Personal/**` denied in both profiles; unlock state in-memory only (restart → re-unlock); CC CLI requires UUID for `--session-id` and rejects in-use UUIDs — `cc_runner._session_file()` probes `~/.claude/projects/<encoded-workdir>/<uuid>.jsonl` and switches to `--resume`; bot on Mac, Hub on Railway; single-tenant. Phase 2 path-syntax quirk stays in effect: `--settings` only matches `Read/Edit/Write/Glob/Grep(~/…)` or `(//abs/…)`, never single-leading-slash absolute paths.
- **Previous phases (closed):**
  - **Phase 2** — `feat 378c854` + path-syntax fix `c5a613f` (2026-04-19). All AC scenarios (AC-3/4/6/7/9) passed on live bot + deployed Hub. Delivered: `POST /api/telegram/auth/check-sender` + `POST /verify-pin` + `PUT …/me/telegram-pin` + `PUT …/me/telegram-user-id` via hybrid `get_current_user` + `restrict_demo`, 5-fail/10-min rate limiter with 15-min lockout, `UserResponse.telegram_pin_configured`. Bot: `hub_client.py`, `.state.json` uuid4 per chat, `unlock.py` 10-min window, `profiles/{locked,unlocked}.settings.json`, `_is_whitelisted` with 60s cache. Frontend: Settings → Telegram Bridge section. Tests at close: backend 822 pass / 9 pre-existing unrelated fails; bot 47 pass; frontend build green.
  - **Phase 1** — `feat f3bc297` + follow-ups. Scaffold, text handler, deterministic `uuid5("tg-default")` session, env-only whitelist.
- **Deferred beyond Phase 3:** launchd LaunchAgent auto-start + log rotation + setup guide (Phase 4). Metal acceleration for faster-whisper (follow-up issue if CPU int8 proves slow).
- **Telegram account context (tangential):** owner's original RU-number TG account was session-cascade-terminated during the 2026-04-18 anti-abuse incident and has not yet been recovered (US location + RU SIM makes SMS/voice verification hard). Development continues on a different TG account; `.env` already holds the matching bot token. `check-sender` is wired against whatever `users.telegram_user_id` the owner configures in Settings UI — no hardcoded account.
- **Previous initiatives (closed):** Planner↔Hub Phase 2 (`af9a094` + follow-ups); Telegram→CC bridge Phase 1+2 (above).
