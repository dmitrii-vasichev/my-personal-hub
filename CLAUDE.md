# My Personal Hub

## Stack
- Frontend: Next.js 16, React 19, TypeScript, Tailwind 4, shadcn, Recharts
- Backend: FastAPI, SQLAlchemy (async), PostgreSQL, Alembic
- Deploy: Vercel (frontend), Railway (backend)
- AI: OpenAI, Anthropic, Google Generative AI
- Integrations: Telegram (Telethon + Bot API), Garmin Connect, Google Calendar, Google Drive, Gmail

## Current Status

- **Mode:** Phase 2 fully shipped — Stage A+B on main (commit `af9a094`), Stage C applied in-place to `~/.claude/skills/planner/` (not tracked in this repo)
- **Feature:** Planner ↔ Personal Hub Phase 2 — skill port + API tokens
- **PRD:** docs/prd-planner-hub-phase2.md
- **Plan:** docs/plans/2026-04-17-planner-hub-phase2.md
- **Stage A (backend):** ✅ ApiToken model, migration, service, hybrid JWT/token auth, REST endpoints, /plans/today shortcuts, integration tests
- **Stage B (frontend):** ✅ react-query hooks, ApiTokensTab component, Settings page integration (visible to admin/regular/demo)
- **Stage C (skill port):** ✅ C1 api section in `config.yaml` · C2 `_api-helpers.md` · C3 `plan-day.md` · C4 `replan.md` (POST+PATCH restores done state after full-replace) · C5 `complete-task.md` · C6 `show-status.md` (today/history/week) · C7 dead Drive-filesystem code removed from `SKILL.md` + orphan `drive_root`/`daily_plans_subdir` dropped from `config.yaml`. Skill edits in `~/.claude/skills/planner/` (no git tracking there).
- **Backend URL:** `https://backend-api-production-1967.up.railway.app` (real Railway domain; earlier PRD/plan placeholder `my-personal-hub-backend.up.railway.app` corrected in this branch)
- **Token:** stored at `~/.claude/skills/planner/.auth` (chmod 600); smoke-verified against `/api/auth/me` = 200
- **Next:** smoke-test the ported skill end-to-end in a fresh Claude session (`/planner plan 4h`, complete, replan, status, history, week) when convenient. No further code work planned for Phase 2.
