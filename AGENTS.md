# Repository Instructions

## Communication And Documentation
- User-facing conversation is in Russian.
- Repository documentation, plans, pull requests, issues, branch names, commit messages, and code comments are in English.

## Execution Model
- Use repo-local documents as the source of truth for substantial work:
  - `docs/PLAN.md` for milestones, ordering, definition of done, and validation commands.
  - `docs/STATUS.md` for the live journal, progress, decisions, blockers, and next actions.
  - `docs/TEST_PLAN.md` for validation scope and known flaky baselines.
  - `docs/BACKLOG.md` for queued or deferred work.
- Preferred rollout loop: implement, validate, fix, update status, continue.
- Do not require `.workflow-state.json`, mandatory GitHub Issue/PR gates, or step-by-step confirmations unless this repository explicitly asks for them.

## Current Project Constraints
- `main` is the integration branch.
- Preserve the existing stack and patterns: FastAPI + SQLAlchemy async + Alembic, Next.js + React Query, and the standalone `telegram_bot` test suite.
- Treat `CLAUDE.md` and `docs/archive/shipped-log.md` as historical context, but keep new execution state in the `docs/` pack above.
- Existing frontend and backend test suites have documented pre-existing flakes/failures; compare touched-area tests first, then broad suites when practical.
