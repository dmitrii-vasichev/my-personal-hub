# Discovery: Portal redesign + Planner UI on Today

## Metadata

| Field | Value |
|-------|-------|
| Date | 2026-04-19 |
| Status | Discovery complete |
| Related | `handoff/HANDOFF.md` (redesign spec, 5 stages), `docs/prd-planner-hub-phase2.md` (shipped; `main` @ `af9a094`) |
| Successor | PRD for Stage 2a — planner UI overlay on redesigned Today |

## Problem Statement

The `handoff/` package fully specs a Brutalist/Terminal redesign of the Personal Hub in 5 sequential PR stages (Tokens → Today → Tasks/Reminders/Jobs → ⌘K+Theme → Mobile+QA). The spec is complete but does **not mention the planner**. Today is built from 6 blocks (HeroPriority, HeroCells, DayTimeline, StatsGrid, RemindersToday, SignalsFeed), all of which pull from `tasks` / `meetings` / `reminders` / `jobs` / `pulse` — none from `daily_plans`.

Phase 2 of the planner-hub integration shipped the write path (skill POSTs plans to the hub), but there is no UI rendering today's plan. The user sees plans only via the `/planner` skill in chat. This discovery closes that loop as part of the redesign rather than as a separate later initiative.

## Context assessed

- **Planner skill** (`~/.claude/skills/planner/`): HTTP client to Hub. Sub-prompts for plan-day, replan, complete-task, show-status. `registry.yaml` lists 4 categories (language/career/home + synthetic `life`) pulling from english / career / linkedin / moving skills. Computes per-slot wall-clock times **for chat display only** — server stores items as an ordered list, slot times are NOT persisted.
- **Backend** (`backend/app/api/planner.py`): `POST/GET /plans`, `/plans/today`, `PATCH /plans/today/items/{id}`, `GET /context` (pending_tasks + due_reminders + calendar_events + yesterday), `GET /analytics`. `ApiToken` + argon2 auth + Settings → Tokens UI already in place.
- **Schema** (`DailyPlan`, `PlanItem`): items have `order`, `title`, `category`, `minutes_planned/actual`, `status`, `linked_task_id` (nullable), `notes` (nullable, currently unused by skill). Plan aggregates: `adherence_pct`, `planned_minutes`, `completed_minutes`, `replans_count`, `categories_planned/actual`.
- **Frontend**: `frontend/src/app/(dashboard)/page.tsx` renders DashboardClient + PulseDigestWidget + VitalsWidget + RecentActivity. No planner widget. Settings → API Tokens tab exists.

## Summary of decisions

### Q1 — How does plan relate to DayTimeline? → **A: plan replaces DayTimeline**

When a plan exists for today, the "day view" on Today is the plan. Meetings and reminders are rendered as read-only inserts, not as a parallel timeline. One coherent day, not two.

### Q2 — Interactivity of the plan on Today → **B: light**

Checkbox to mark an item done. On click: `PATCH /plans/today/items/{id}` with `{status: done, minutes_actual: N}`. Aggregates (`completed_minutes`, `adherence_pct`, `categories_actual`) are pulled from the PATCH response and re-rendered. **No** drag-to-reorder, add/delete, edit title, replan from UI. All complex editing stays in the `/planner` skill (and Telegram bot).

### Q3 — Unified timeline when plan items lack wall-clock times → **A: two-section**

Plan items have only `order` + `minutes_planned`, no wall-clock times. We accept this honestly — no schema extension, no frontend duplication of slot-time algorithm.

- **FIXED SCHEDULE** (top): calendar events with real `HH:MM` times, sorted chronologically.
- **FOCUS QUEUE** (below): plan items in `order`, each with a duration chip (`30m`) and category tag. No timestamps.

This matches how the skill actually conceives the day — as an ordered work queue around fixed anchors, not as a calendar.

### Q4 — Priority_01 Hero vs Plan → **C: compact Plan-bar replaces Hero when plan exists**

Handoff's big Hero (~30-40% of page) becomes a compact 1–2 line Plan-bar when a plan exists:

```
PLAN · 2026-04-20       ■■■■■□□□□□  2/7 · 85/280m
▶ NEXT · English lesson Unit 5 · 90m
```

Contents: date, progress bar, `completed/total items`, `completed/planned minutes`, one "NEXT" pointer to the next unfinished item. No deck description, no large CTA buttons. When **no plan exists**, the full handoff Hero (P1 task with countdown + deck + CTAs) is shown as fallback. See Q6.

### Q5 — Separate `/planner` page or Today-only → **C: one Stats Grid cell**

No new page and no new sidebar route in this phase. Analytics and history remain accessible via the skill (`/planner week`, `/planner history YYYY-MM-DD`). One cell in the existing handoff 2×2 Stats Grid is allocated to `Plan adherence · 7d`, pulling from `GET /api/planner/analytics?from=today-7d&to=today` and rendering the average adherence % + a delta arrow.

### Q6 — Empty state (no plan today) → **C: hybrid fallback**

Most mornings open with no plan yet. When `GET /plans/today` returns 404:
- **Plan-bar area** shows a thin CTA strip: `📋 No plan for today. Run /planner plan Xh in Claude Code.`
- **Rest of Today** reverts to handoff-spec exactly: big Hero (P1 task), DayTimeline (union view of tasks + meetings + reminders + focus), full Stats Grid (including handoff's original Focus cell — see note in Q8).
- As soon as skill POSTs a plan, page re-fetches and switches to plan-mode.

### Q7 — Staging within handoff's 5-PR migration → **B: separate Stage 2a**

- Stage 1 — Tokens + shell (handoff as-is)
- Stage 2 — Today (handoff as-is: big Hero + DayTimeline + 4-cell Stats Grid, no planer)
- **Stage 2a — planner overlay** (this discovery)
- Stage 3 — Tasks / Reminders / Jobs (handoff as-is)
- Stage 4 — ⌘K + Theme (handoff as-is)
- Stage 5 — Adaptive + QA (handoff as-is)

Stage 2 ships handoff-Today cleanly first. Stage 2a bolts planner logic onto the already-migrated Today. Two tight PRs instead of one double-scope PR.

### Q8 — Which Stats Grid cell gets replaced → **B: `Focus · today`**

The 4 cells in handoff are `Focus · today` / `Notes · 30d` / `Overdue tasks` / `Response rate · 30d`. `Focus · today` depends on a `focus_sessions` model that doesn't exist in the codebase — the cell is mocked in the handoff spec. Replacing it with `Plan adherence · 7d` swaps a mock for a real metric. Note: when no plan exists (Q6 fallback), the Stats Grid still renders — Plan-adherence cell shows whatever analytics returns for days that did have plans (gracefully handles sparse history).

## Scope

### In scope (Stage 2a)

- New frontend component: `<PlanBar />` — compact progress + NEXT pointer. Rendered at top of Today when plan exists.
- New frontend component: `<FocusQueue />` — ordered list of plan items with checkbox, category tag, duration chip, linked-task badge.
- New frontend component: `<FixedSchedule />` — meetings + calendar events for today, time-sorted, read-only.
- Modification: Stats Grid cell `Focus · today` → `Plan adherence · 7d`.
- Modification: Today page root — conditional render (plan exists → plan-mode; 404 → handoff-mode + CTA strip).
- API client: `GET /plans/today`, `PATCH /plans/today/items/{id}`, `GET /analytics?from=&to=`.
- Optimistic UI on checkbox + server-state reconciliation from PATCH response.
- Auth: reuses existing JWT session cookie (same as other pages).

### Deferred / out of scope

- No schema changes. `PlanItem.scheduled_start/end` considered and rejected (Q3).
- No planner-specific writes to `plan_item.notes` from the skill (rejected when Q4=C chose Plan-bar without deck).
- No new sidebar pin, no new route `/planner`, no history/week/analytics UI page (Q5).
- No drag-to-reorder, no add/delete, no replan button on Today (Q2).
- No Signals-feed column for planner events (not discussed = not in scope).
- No top-bar integration (e.g., `PLAN 4/7` global stat) — kept handoff-minimal.
- Handling of long plans on mobile — defer to Stage 5 QA pass.

## Key implementation details (for PRD)

1. **Reminder double-display avoidance.** The skill injects all `/context.due_reminders` into plan items as `urgent=true` in the earliest slot. When plan exists, `<FixedSchedule />` should render **calendar events only** (not reminders) to avoid double-showing the same reminder (once in FOCUS QUEUE as a plan item, once in FIXED SCHEDULE). When plan does not exist, `<FixedSchedule />` should show calendar events + reminders (the handoff fallback path).
2. **Category labels.** Plan items carry `category` as a registry key (`language`, `career`, `home`, `life`). Frontend needs a human-readable label map (`language → LANG`, `career → CAREER`, `home → HOME`, `life → LIFE`). Either hardcoded in frontend or fetched from a new backend endpoint. Hardcode for MVP — category set is small and stable.
3. **`linked_task_id` badge in FOCUS QUEUE.** When set, row shows `#42` chip linking to `/tasks/42`. Task title/priority visible on hover. When `null`, just the plan item's own `title` + category.
4. **Live refresh.** Today page should refresh plan data on window focus (visibility change) — user may have completed an item via Telegram bot or skill chat while the tab was in background. Simple refetch, not polling.
5. **`minutes_actual` on checkbox click.** MVP: PATCH with `minutes_actual = minutes_planned` (assume user stuck to plan). If user wants to report a different number, they go through skill (`я закончил английский, 45 минут`). Keeping UI minimal.
6. **Empty FIXED section.** If no calendar events today and plan exists — hide FIXED SCHEDULE entirely, not "nothing fixed" placeholder. Visual noise reduction.

## Out of scope

See "Deferred / out of scope" above.

## Open questions

- None blocking. Implementation details flagged above are decisions the PRD can lock in.

## Next step

Run `/dev plan` (or `/workflow`) and reference this discovery file to draft a PRD for Stage 2a. Expected PRD sections: user scenarios (morning-no-plan, morning-after-plan, midday-completion, switch-via-telegram), functional requirements (per component), acceptance criteria, file layout (frontend-only changes — no backend, no skill), staging within Stage 2a (probably 2 commits: components + integration).
