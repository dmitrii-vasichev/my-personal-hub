# Audit Actions — 2026-03-23

Remaining items from portfolio-ready audit. Each section has a route and affected files.

## 1. Refactor setState-in-effect (6 lint errors)

**Route:** `/dev chore refactor setState-in-effect`

Replace `useEffect + setState` pattern with derived state or `useMemo`. Each file initializes local state from fetched data inside useEffect — should derive directly or use controlled/uncontrolled pattern.

| File | Line | Description |
|------|------|-------------|
| `frontend/src/app/(dashboard)/notes/page.tsx` | 61, 74 | `setSelectedFileId` / `setSelectedNoteId` in effect — derive from URL params |
| `frontend/src/components/settings/garmin-tab.tsx` | 45 | `setSyncInterval` from `connection` data in effect |
| `frontend/src/components/settings/pulse-settings-tab.tsx` | 40 | `setPollingInterval` + 4 more setState calls from `settings` in effect |
| `frontend/src/__tests__/demo-mode.test.tsx` | 223 | `@typescript-eslint/no-explicit-any` — replace `any` with proper type |

## 2. Suppress ruff F821 for SQLAlchemy forward refs

**Route:** `/dev chore suppress-ruff-f821`

Add per-file `noqa` or configure `ruff.toml` to ignore F821 in model files.

| File | Line | Forward ref |
|------|------|-------------|
| `backend/app/models/job.py` | 89, 92 | `"Resume"`, `"CoverLetter"` |
| `backend/app/models/resume.py` | 30, 47 | `"Job"` |

## 3. README: screenshots

**Route:** manual

Capture screenshots of key screens and add to `docs/screenshots/`:
- Dashboard (all widgets visible)
- Vitals page (charts + briefing)
- Pulse page (digest view)
- Task manager (Kanban board)
- Login page (portfolio showcase)

Then update `README.md` — replace the `<!-- TODO: Add screenshots -->` block.

## 4. README: "What I learned" section

**Route:** `/dev chore readme-what-i-learned`

Add a section after "Project Structure" covering challenges and learnings.
Needs input from Dmitry — key topics to cover:
- AI integration patterns (multi-provider LLM, structured digest generation)
- Telegram MTProto + Bot API dual approach
- Garmin Connect reverse-engineering (rate limits, 429 handling, circuit breaker)
- Demo mode architecture (role-based data isolation, auto-seeding)
- Real-time polling with React Query

## 5. Large files to refactor (optional, low priority)

**Route:** `/dev chore split-large-components` (when touching these files)

### Frontend (>400 lines)
| File | Lines | Suggestion |
|------|-------|------------|
| `frontend/src/components/jobs/job-detail.tsx` | 490 | Extract tabs into sub-components |
| `frontend/src/app/(dashboard)/tasks/[id]/page.tsx` | 477 | Extract checklist, activity, detail sections |

### Backend (>400 lines)
| File | Lines | Suggestion |
|------|-------|------------|
| `backend/app/scripts/seed_demo.py` | 980 | Split per-module seed functions into separate files |
| `backend/app/services/vitals_briefing.py` | 618 | Extract data fetching, formatting, LLM call into sub-modules |
| `backend/app/services/resume.py` | 450 | Separate generation logic from CRUD |
| `backend/app/services/task.py` | 441 | Extract business logic from CRUD |

## 6. Code duplication (optional, low priority)

**Route:** `/dev chore extract-shared-utils` (when touching these files)

| What | Where | Fix |
|------|-------|-----|
| `hexToRgba()` | `tags-management-tab.tsx:12`, `tag-pill.tsx:4` | Extract to `src/lib/color.ts` |
| `API_BASE` | `lib/api.ts:1`, `resume-section.tsx:26` | Import from `lib/api.ts` |
