# My Personal Hub

## Stack
- Frontend: Next.js 16, React 19, TypeScript, Tailwind 4, shadcn, Recharts
- Backend: FastAPI, SQLAlchemy (async), PostgreSQL, Alembic
- Deploy: Vercel (frontend), Railway (backend)
- AI: OpenAI, Anthropic, Google Generative AI
- Integrations: Telegram (Telethon + Bot API), Garmin Connect, Google Calendar, Google Drive, Gmail

## Current Status

- **Mode:** Phase 2 Stage A+B shipped on main (commit `af9a094`)
- **Feature:** Planner ↔ Personal Hub Phase 2 — skill port + API tokens
- **PRD:** docs/prd-planner-hub-phase2.md
- **Plan:** docs/plans/2026-04-17-planner-hub-phase2.md
- **Stage A (backend):** ✅ ApiToken model, migration, service, hybrid JWT/token auth, REST endpoints, /plans/today shortcuts, integration tests
- **Stage B (frontend):** ✅ react-query hooks, ApiTokensTab component, Settings page integration (visible to admin/regular/demo)
- **Deploy status:** pushed to origin/main; Vercel + Railway should auto-deploy
- **Next:** Stage C — port `/planner` skill to HTTP (lives in `~/.claude/skills/planner/`, not this repo). Generate a real API token via Settings UI, save to `~/.claude/skills/planner/.auth`, then rewrite sub-prompts per plan.md Stage C tasks C1-C8.
