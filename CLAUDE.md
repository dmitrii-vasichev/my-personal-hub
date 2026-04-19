# My Personal Hub

## Stack
- Frontend: Next.js 16, React 19, TypeScript, Tailwind 4, shadcn, Recharts
- Backend: FastAPI, SQLAlchemy (async), PostgreSQL, Alembic
- Deploy: Vercel (frontend), Railway (backend)
- AI: OpenAI, Anthropic, Google Generative AI
- Integrations: Telegram (Telethon + Bot API), Garmin Connect, Google Calendar, Google Drive, Gmail

## Current Status

- **Mode:** Telegram→CC bridge Phase 3 **shipped and live-smoke-verified on `main`** (squash `c4f9805`, 2026-04-19). No blocking code work.
- **Feature (closed):** Telegram to Claude Code bridge — Phase 3 (voice input via faster-whisper, per-chat request queue with backpressure, stream-json progress parsing behind `TELEGRAM_PROGRESS_ENABLED`, `/help` / `/status` / `/cancel` commands).
- **Branch:** `main` (feature branch `feature/telegram-bridge-phase3` deleted after merge).
- **PRD:** `docs/prd-telegram-claude-bridge.md` (patched 2026-04-19 — removed spinner fallback, always-on voice-preview policy, `/cancel` half-state caveat, grace-flag gating on progress edits).
- **Plan:** `docs/plans/2026-04-19-telegram-claude-bridge-phase3.md` (local only).
- **Phase 3 outcome summary:**
  - Bot: new modules `request_queue.py`, `progress.py`, `voice.py`. Extended `cc_runner.py` with `run_cc_streaming` (streaming variant for opt-in progress) + `on_spawn` callback on `run_cc` (for `/cancel` to stash the subprocess handle). `main.py` rewritten so every message goes through the per-chat queue; `handle_text` and `handle_voice` share `_run_cc_with_optional_progress` and `_render_result`. `unlock.py` gains `unlock_expires_at` for `/status`.
  - Queue semantics: `MAX_INFLIGHT = 5` counts active + waiting. Msg 1 runs, msgs 2–5 reply `⏳ in queue (pos 1..4)`, msg 6+ replies `⛔ queue full, try later` and is dropped. Plan's original qsize-only math was corrected during Task 1.
  - Voice: faster-whisper `small` CPU int8, lazy-loaded on first voice message, language auto-detect (ru/en). Transcript **always** echoed back as `🎙 transcribed: …` regardless of length (PRD Q4). Handler order: whitelist → enqueue (queue-full rejection runs BEFORE download to avoid wasted Whisper cycles) → download → transcribe → echo → CC.
  - Progress (opt-in): `TELEGRAM_PROGRESS_ENABLED=false` by default; when flipped on, status message is edited on `tool_use` events throttled at ≥10s. No spinner fallback — on `JSONDecodeError` the parser disables itself for the invocation. Task 0 spike pinned the event shape: `tool_use` is a nested block inside `assistant.message.content[]`, `result.result` is the canonical final text, `--verbose` is mandatory alongside `--output-format stream-json`, `stdin=DEVNULL` suppresses the "no stdin data" warning.
  - `/cancel` semantics: SIGINT the active subprocess; accept half-state per PRD Q5. Gates on `proc.returncode is None` to avoid signalling a reaped PID while the worker is still streaming chunks (fixed mid-build after live smoke).
  - Live smoke (2026-04-19): AC-2 voice ✅ (transcript echo + CC reply), AC-8 queue backpressure ✅, `/cancel` pre-finish ✅, `/cancel` post-finish ✅. Progress-flag flip smoke deferred (owner will enable only after ~48h of clean traffic).
  - Tests: bot 113 passed (was 47 at Phase 2 close). Breakdown: 47 Phase 2 baseline + 7 queue + 2 `on_spawn` + 10 handler (/status, /cancel, /help + queue routing + /cancel-after-finish regression) + 27 progress parser + 6 streaming cc_runner + 4 progress-flag routing + 6 voice unit + 4 voice handler. Backend 822 / 9 pre-existing (unchanged from Phase 2 sign-off). Frontend build green.
  - Build-time fixes that shipped alongside the features: `requests==2.33.1` pinned (faster-whisper 1.1.1 imports it without declaring it); `/cancel` returncode gate (see above).
- **Anti-abuse guard rails (still load-bearing after the 2026-04-18 freeze):** no spinner fallback ever; ≥10s hard-coded minimum between status edits; `TELEGRAM_PROGRESS_ENABLED` default `false` so default behaviour matches Phase 2's single-edit pattern; `stdin=DEVNULL` on the streaming subprocess; progress parser auto-disables on first `JSONDecodeError`.
- **Key constraints (still in force):** subscription-based `claude -p` only (no Anthropic API); `Notes/Personal/**` denied in both profiles; unlock state in-memory only (restart → re-unlock); CC CLI requires UUID for `--session-id` and rejects in-use UUIDs — `cc_runner._session_file()` probes `~/.claude/projects/<encoded-workdir>/<uuid>.jsonl` and switches to `--resume`; bot on Mac, Hub on Railway; single-tenant. Phase 2 path-syntax quirk stays in effect: `--settings` only matches `Read/Edit/Write/Glob/Grep(~/…)` or `(//abs/…)`, never single-leading-slash absolute paths.
- **Previous phases (closed):**
  - **Phase 2** — `feat 378c854` + path-syntax fix `c5a613f` (2026-04-19). Hub-backed `check-sender` whitelist, PIN-gated `/unlock`, locked/unlocked `settings.json` profiles, per-chat `/new` session reset. Backend 822 / 9 / 47 bot tests at close. All AC scenarios (AC-3/4/6/7/9) passed on live bot + deployed Hub.
  - **Phase 1** — `feat f3bc297` + follow-ups. Scaffold, text handler, deterministic `uuid5("tg-default")` session, env-only whitelist.
- **Deferred to later phases:** launchd LaunchAgent auto-start + log rotation + setup guide (Phase 4). Metal acceleration for faster-whisper (follow-up issue if CPU int8 proves slow). Progress flag smoke test — owner will run after ≥48h of clean traffic on the bot token.
- **Telegram account context (tangential):** owner's original RU-number TG account was session-cascade-terminated during the 2026-04-18 anti-abuse incident and has not yet been recovered (US location + RU SIM makes SMS/voice verification hard). Development continues on a different TG account; `.env` already holds the matching bot token.
- **Next:** owner ready to plan Phase 4 (launchd auto-start) whenever they want. No blocking code work.
- **Previous initiatives (closed):** Planner↔Hub Phase 2 (`af9a094` + follow-ups); Telegram→CC bridge Phase 1+2+3 (above).
