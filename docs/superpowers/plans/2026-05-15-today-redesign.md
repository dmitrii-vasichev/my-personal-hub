# Today Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild Today as a health-first daily operating view with Garmin factoids, quick Action capture, and expandable Actions for today.

**Architecture:** Keep this as frontend-first work. Replace the current planner-mode Today composition with small Today-specific components, reuse existing React Query hooks, and extract the existing Action row so Today and `/actions` share interaction behavior without duplicating the edit/done/snooze/delete logic.

**Tech Stack:** Next.js app router, React 19, TypeScript, React Query, Vitest, Testing Library, existing brutalist dashboard CSS conventions.

---

## File Structure

- Modify `frontend/src/app/(dashboard)/page.tsx`: render the new Today composition only.
- Rename and modify `frontend/src/app/(dashboard)/__tests__/page-plan-mode.test.tsx` to `frontend/src/app/(dashboard)/__tests__/today-redesign.test.tsx`: replace planner-mode expectations with health, quick-add, and Actions Today expectations.
- Create `frontend/src/components/actions/action-row.tsx`: shared expandable Action row extracted from `action-list.tsx`.
- Modify `frontend/src/components/actions/action-list.tsx`: keep grouping/list orchestration, import shared `ActionRow`.
- Create `frontend/src/components/today/today-action-utils.ts`: local-date helpers, Today filtering, and Today sorting.
- Create `frontend/src/components/today/today-action-utils.test.ts`: focused utility tests.
- Create `frontend/src/components/today/health-factoids.tsx`: Training Readiness, HRV, and Sleep tiles.
- Create `frontend/src/components/today/__tests__/health-factoids.test.tsx`: factoid formatting and empty-state tests.
- Create `frontend/src/components/today/quick-add-today-action-form.tsx`: Action quick-add with today as the implicit date.
- Create `frontend/src/components/today/__tests__/quick-add-today-action-form.test.tsx`: create payload tests.
- Create `frontend/src/components/today/actions-today.tsx`: query Actions, filter to today, render shared rows.
- Create `frontend/src/components/today/__tests__/actions-today.test.tsx`: filter, empty state, expand, and Done mutation tests.
- Modify `docs/PLAN.md`, `docs/STATUS.md`, and `docs/TEST_PLAN.md`: make Today Redesign the active execution pack.

## Task 1: Extract Shared Action Row

**Files:**
- Create: `frontend/src/components/actions/action-row.tsx`
- Modify: `frontend/src/components/actions/action-list.tsx`
- Test: `frontend/src/components/actions/__tests__/action-list-groups.test.tsx`

- [ ] **Step 1: Run the current ActionList focused tests before extraction**

Run:

```bash
cd frontend && npm test -- --run src/components/actions/__tests__/action-list-groups.test.tsx
```

Expected: PASS. If it fails before edits, record the failure in `docs/STATUS.md` and stop this task.

- [ ] **Step 2: Create the shared ActionRow file**

Move the following existing code from `frontend/src/components/actions/action-list.tsx` into `frontend/src/components/actions/action-row.tsx`:

- action row imports from `date-fns`, `lucide-react`, `sonner`, UI components, `StartFocusButton`, `ChecklistEditor`, and action mutation hooks.
- `WEEKDAYS`
- `recurrenceLabel`
- `snoozeBadgeClass`
- `relativeLabel`
- `tomorrowAt`
- `withTzOffset`
- `RECURRENCE_OPTIONS`
- `RECURRENCE_LABELS`
- `URL_PATTERN`
- `hasUrl`
- `LinkifiedText`
- `EditActionForm`
- `EditActionDialog`
- `ActionRow`

After copying the current row code, change the row signature so the first lines
of the exported row are:

```tsx
interface ActionRowProps {
  action: Action;
  expanded: boolean;
  onToggle: () => void;
  showFocusButton?: boolean;
}

export function ActionRow({
  action,
  expanded,
  onToggle,
  showFocusButton = true,
}: ActionRowProps) {
```

Change the expanded action panel inside `ActionRow` so Focus can be hidden on Today while staying visible on `/actions`.
Add this constant next to `isScheduled` and `isPending`:

```tsx
const expandedActionCount =
  (showFocusButton ? 1 : 0) + 3 + (isScheduled ? 1 : 0);
```

Before `expandedActions`, assign the current details/checklist JSX and button JSX to local constants:

```tsx
const detailsPanel = hasDetails || hasChecklist ? (
  <div className="space-y-3">
    {hasDetails && (
      <div className="whitespace-pre-wrap break-words text-[12px] leading-relaxed text-[color:var(--ink-2)]">
        <LinkifiedText text={details} />
      </div>
    )}
    {hasChecklist && (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-[1.5px] text-[color:var(--ink-3)]">
          <span>Checklist</span>
          <span>{doneCount}/{checklist.length}</span>
        </div>
        <div className="flex flex-col gap-1.5">
          {checklist.map((item) => (
            <label key={item.id} className="flex items-start gap-2 text-[12px] leading-snug text-[color:var(--ink-2)]">
              <input
                type="checkbox"
                checked={item.completed}
                onChange={() => handleChecklistToggle(item.id)}
                disabled={isPending}
                className="mt-0.5 h-3.5 w-3.5 border-[color:var(--line)] accent-[color:var(--accent)]"
              />
              <span className={item.completed ? "line-through text-[color:var(--ink-3)]" : ""}>
                {item.text}
              </span>
            </label>
          ))}
        </div>
      </div>
    )}
  </div>
) : (
  <button
    type="button"
    onClick={() => setEditOpen(true)}
    className="flex items-center gap-1.5 text-[11px] uppercase tracking-[1.5px] text-[color:var(--ink-3)] hover:text-[color:var(--accent)]"
  >
    <StickyNote className="h-3.5 w-3.5" />
    Add details
  </button>
);
```

Keep the current Done, Edit, Snooze, and Delete button JSX as separate constants named `doneButton`, `editButton`, `snoozeButton`, and `deleteButton`. Preserve their current click handlers, toast behavior, popover content, and confirmation dialog behavior.

Then replace the expanded action panel grid wrapper with this wrapper:

```tsx

const expandedActions = expanded && (
  <>
    <div className="border-t-[1.5px] border-[color:var(--line)] bg-[color:var(--bg)] px-3 py-3 font-mono">
      {detailsPanel}
    </div>
    <div
      className="grid gap-2 border-t-[1.5px] border-[color:var(--line)] bg-[color:var(--bg)] px-3 py-2"
      style={{
        gridTemplateColumns: `repeat(${expandedActionCount}, minmax(0, 1fr))`,
      }}
    >
      {showFocusButton ? (
        <div className="flex flex-col items-center gap-1 py-2 text-[11px] uppercase tracking-[1.5px] font-mono text-[color:var(--ink-2)]">
          <StartFocusButton
            actionId={action.id}
            className="!size-5 max-md:!size-8 border-0"
          />
          Focus
        </div>
      ) : null}
      {doneButton}
      {editButton}
      {isScheduled ? snoozeButton : null}
      {deleteButton}
    </div>
  </>
);
```

- [ ] **Step 3: Trim action-list.tsx to list orchestration**

In `frontend/src/components/actions/action-list.tsx`, remove the moved imports and moved helper/component definitions. Keep:

- `useMemo`
- `useState`
- `format`
- `parseISO`
- `startOfDay`
- `Bell`
- React Query test-safe wrapper behavior as-is
- `ActionList`
- date grouping helpers
- `ActionListProps`

Add this import:

```tsx
import { ActionRow } from "./action-row";
```

Keep the row render call in `ActionList`:

```tsx
<ActionRow
  key={action.id}
  action={action}
  expanded={expandedId === action.id}
  onToggle={() => setExpandedId(expandedId === action.id ? null : action.id)}
/>
```

- [ ] **Step 4: Run the focused ActionList test**

Run:

```bash
cd frontend && npm test -- --run src/components/actions/__tests__/action-list-groups.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit the extraction**

Run:

```bash
git add frontend/src/components/actions/action-row.tsx frontend/src/components/actions/action-list.tsx
git commit -m "refactor(actions): extract shared action row"
```

## Task 2: Add Today Action Utilities

**Files:**
- Create: `frontend/src/components/today/today-action-utils.ts`
- Create: `frontend/src/components/today/today-action-utils.test.ts`

- [ ] **Step 1: Write failing utility tests**

Create `frontend/src/components/today/today-action-utils.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Action } from "@/types/action";
import {
  actionBelongsToLocalDay,
  localDateString,
  sortTodayActions,
  withLocalTzOffset,
} from "./today-action-utils";

function makeAction(overrides: Partial<Action> = {}): Action {
  return {
    id: 1,
    user_id: 1,
    title: "Action",
    details: null,
    checklist: [],
    action_date: "2026-05-15",
    remind_at: null,
    mode: "anytime",
    status: "pending",
    snoozed_until: null,
    recurrence_rule: null,
    snooze_count: 0,
    notification_sent_count: 0,
    completed_at: null,
    is_floating: true,
    is_urgent: false,
    created_at: "2026-05-15T12:00:00Z",
    updated_at: "2026-05-15T12:00:00Z",
    ...overrides,
  };
}

describe("today-action-utils", () => {
  it("formats local dates as yyyy-mm-dd", () => {
    expect(localDateString(new Date(2026, 4, 5, 9, 0, 0))).toBe("2026-05-05");
  });

  it("creates local timezone ISO strings for selected times", () => {
    expect(withLocalTzOffset("2026-05-15", "09:30")).toMatch(
      /^2026-05-15T09:30:00[+-]\d{2}:\d{2}$/,
    );
  });

  it("matches actions by action_date or remind_at on the reference local day", () => {
    const ref = new Date(2026, 4, 15, 12, 0, 0);
    expect(actionBelongsToLocalDay(makeAction({ action_date: "2026-05-15" }), ref)).toBe(true);
    expect(actionBelongsToLocalDay(makeAction({ action_date: "2026-05-16" }), ref)).toBe(false);
    expect(
      actionBelongsToLocalDay(
        makeAction({ action_date: null, remind_at: "2026-05-15T18:00:00-06:00" }),
        ref,
      ),
    ).toBe(true);
  });

  it("sorts timed actions first, then urgent anytime, then creation time", () => {
    const sorted = sortTodayActions([
      makeAction({ id: 1, title: "Anytime normal", created_at: "2026-05-15T12:00:00Z" }),
      makeAction({
        id: 2,
        title: "Scheduled late",
        remind_at: "2026-05-15T18:00:00-06:00",
        is_floating: false,
      }),
      makeAction({
        id: 3,
        title: "Scheduled early",
        remind_at: "2026-05-15T09:00:00-06:00",
        is_floating: false,
      }),
      makeAction({
        id: 4,
        title: "Anytime urgent",
        is_urgent: true,
        created_at: "2026-05-15T13:00:00Z",
      }),
    ]);

    expect(sorted.map((action) => action.title)).toEqual([
      "Scheduled early",
      "Scheduled late",
      "Anytime urgent",
      "Anytime normal",
    ]);
  });
});
```

- [ ] **Step 2: Run the utility tests to verify they fail**

Run:

```bash
cd frontend && npm test -- --run src/components/today/today-action-utils.test.ts
```

Expected: FAIL because `today-action-utils.ts` does not exist.

- [ ] **Step 3: Implement today-action-utils.ts**

Create `frontend/src/components/today/today-action-utils.ts`:

```ts
import type { Action } from "@/types/action";
import { isSameLocalDay, parseLocalDateSource } from "./today-date";

const pad2 = (n: number) => String(n).padStart(2, "0");

export function localDateString(date: Date = new Date()): string {
  return [
    date.getFullYear(),
    pad2(date.getMonth() + 1),
    pad2(date.getDate()),
  ].join("-");
}

export function withLocalTzOffset(date: string, time: string): string {
  const offset = new Date().getTimezoneOffset();
  const sign = offset <= 0 ? "+" : "-";
  const abs = Math.abs(offset);
  return `${date}T${time}:00${sign}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`;
}

export function actionBelongsToLocalDay(
  action: Action,
  ref: Date = new Date(),
): boolean {
  const source = action.action_date ?? action.remind_at;
  return isSameLocalDay(source, ref);
}

export function sortTodayActions(actions: Action[]): Action[] {
  return [...actions].sort((a, b) => {
    const aScheduled = a.remind_at ? 0 : 1;
    const bScheduled = b.remind_at ? 0 : 1;
    if (aScheduled !== bScheduled) return aScheduled - bScheduled;

    if (a.remind_at && b.remind_at) {
      return (
        parseLocalDateSource(a.remind_at)!.getTime() -
        parseLocalDateSource(b.remind_at)!.getTime()
      );
    }

    const aUrgent = a.is_urgent ? 0 : 1;
    const bUrgent = b.is_urgent ? 0 : 1;
    if (aUrgent !== bUrgent) return aUrgent - bUrgent;

    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}
```

- [ ] **Step 4: Run the utility tests to verify they pass**

Run:

```bash
cd frontend && npm test -- --run src/components/today/today-action-utils.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the utilities**

Run:

```bash
git add frontend/src/components/today/today-action-utils.ts frontend/src/components/today/today-action-utils.test.ts
git commit -m "feat(today): add action date utilities"
```

## Task 3: Build Health Factoids

**Files:**
- Create: `frontend/src/components/today/health-factoids.tsx`
- Create: `frontend/src/components/today/__tests__/health-factoids.test.tsx`

- [ ] **Step 1: Write failing factoid tests**

Create `frontend/src/components/today/__tests__/health-factoids.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TodayHealthFactoids } from "../health-factoids";
import type { VitalsDailyMetric, VitalsSleep } from "@/types/vitals";

function metric(overrides: Partial<VitalsDailyMetric> = {}): VitalsDailyMetric {
  return {
    id: 1,
    date: "2026-05-15",
    steps: null,
    distance_m: null,
    calories_active: null,
    calories_total: null,
    floors_climbed: null,
    intensity_minutes: null,
    resting_hr: null,
    avg_hr: null,
    max_hr: null,
    min_hr: null,
    avg_stress: null,
    max_stress: null,
    body_battery_high: null,
    body_battery_low: null,
    hrv_last_night_avg: 52,
    hrv_weekly_avg: 55,
    hrv_status: "BALANCED",
    vo2_max: null,
    training_readiness: 82,
    training_readiness_level: "READY",
    training_readiness_recovery_hours: 6,
    training_readiness_feedback: "Productive training is possible.",
    ...overrides,
  };
}

function sleep(overrides: Partial<VitalsSleep> = {}): VitalsSleep {
  return {
    id: 1,
    date: "2026-05-15",
    duration_seconds: 26580,
    deep_seconds: null,
    light_seconds: null,
    rem_seconds: null,
    awake_seconds: null,
    sleep_score: 78,
    start_time: null,
    end_time: null,
    ...overrides,
  };
}

describe("TodayHealthFactoids", () => {
  it("renders readiness, weekly HRV with last-night subtext, and sleep duration", () => {
    render(<TodayHealthFactoids metrics={metric()} sleep={sleep()} isLoading={false} />);

    expect(screen.getByText("Training readiness")).toBeInTheDocument();
    expect(screen.getByText("82")).toBeInTheDocument();
    expect(screen.getByText("READY - 6h recovery")).toBeInTheDocument();

    const hrvTile = screen.getByText("HRV").closest("div");
    expect(hrvTile).not.toBeNull();
    expect(within(hrvTile!).getByText("55 ms")).toBeInTheDocument();
    expect(within(hrvTile!).getByText("Last night 52 ms - BALANCED")).toBeInTheDocument();

    expect(screen.getByText("Sleep")).toBeInTheDocument();
    expect(screen.getByText("7h 23m")).toBeInTheDocument();
    expect(screen.getByText("Score 78")).toBeInTheDocument();
  });

  it("does not replace missing weekly HRV with last-night HRV", () => {
    render(
      <TodayHealthFactoids
        metrics={metric({ hrv_weekly_avg: null, hrv_last_night_avg: 52 })}
        sleep={sleep()}
        isLoading={false}
      />,
    );

    const hrvTile = screen.getByText("HRV").closest("div");
    expect(within(hrvTile!).getByText("--")).toBeInTheDocument();
    expect(within(hrvTile!).getByText("Last night 52 ms - BALANCED")).toBeInTheDocument();
  });

  it("renders stable skeleton tiles while loading", () => {
    render(<TodayHealthFactoids metrics={null} sleep={null} isLoading />);
    expect(screen.getByTestId("today-health-loading")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the factoid tests to verify they fail**

Run:

```bash
cd frontend && npm test -- --run src/components/today/__tests__/health-factoids.test.tsx
```

Expected: FAIL because `health-factoids.tsx` does not exist.

- [ ] **Step 3: Implement health-factoids.tsx**

Create `frontend/src/components/today/health-factoids.tsx`:

```tsx
"use client";

import type { VitalsDailyMetric, VitalsSleep } from "@/types/vitals";

interface TodayHealthFactoidsProps {
  metrics: VitalsDailyMetric | null | undefined;
  sleep: VitalsSleep | null | undefined;
  isLoading: boolean;
}

interface FactoidProps {
  label: string;
  value: string;
  subValue: string;
  title?: string;
}

function formatNumber(value: number | null | undefined, suffix = ""): string {
  if (value == null) return "--";
  return `${value}${suffix}`;
}

function formatSleepDuration(seconds: number | null | undefined): string {
  if (seconds == null) return "--";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

function formatReadinessSubtext(metrics: VitalsDailyMetric | null | undefined): string {
  const level = metrics?.training_readiness_level ?? null;
  const recovery = metrics?.training_readiness_recovery_hours ?? null;
  if (level && recovery != null) return `${level} - ${recovery}h recovery`;
  if (level) return level;
  if (recovery != null) return `${recovery}h recovery`;
  return "No readiness data";
}

function formatHrvSubtext(metrics: VitalsDailyMetric | null | undefined): string {
  const lastNight = metrics?.hrv_last_night_avg ?? null;
  const status = metrics?.hrv_status ?? null;
  if (lastNight != null && status) return `Last night ${lastNight} ms - ${status}`;
  if (lastNight != null) return `Last night ${lastNight} ms`;
  if (status) return status;
  return "No HRV data";
}

function Factoid({ label, value, subValue, title }: FactoidProps) {
  return (
    <div
      className="border-[1.5px] border-[color:var(--line)] bg-[color:var(--bg-2)] p-[14px] min-h-[96px]"
      title={title}
    >
      <div className="text-[9.5px] tracking-[2px] uppercase text-[color:var(--ink-3)]">
        {label}
      </div>
      <div className="mt-3 font-[family-name:var(--font-space-grotesk)] font-bold text-[30px] leading-[1] text-[color:var(--ink)]">
        {value}
      </div>
      <div className="mt-2 text-[10.5px] uppercase tracking-[1px] text-[color:var(--ink-3)]">
        {subValue}
      </div>
    </div>
  );
}

export function TodayHealthFactoids({
  metrics,
  sleep,
  isLoading,
}: TodayHealthFactoidsProps) {
  if (isLoading) {
    return (
      <div
        className="grid grid-cols-1 gap-[10px] sm:grid-cols-3"
        data-testid="today-health-loading"
      >
        {["readiness", "hrv", "sleep"].map((key) => (
          <div
            key={key}
            className="h-[96px] animate-pulse border-[1.5px] border-[color:var(--line)] bg-[color:var(--bg-2)]"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-[10px] sm:grid-cols-3" data-testid="today-health">
      <Factoid
        label="Training readiness"
        value={formatNumber(metrics?.training_readiness)}
        subValue={formatReadinessSubtext(metrics)}
        title={metrics?.training_readiness_feedback ?? undefined}
      />
      <Factoid
        label="HRV"
        value={formatNumber(metrics?.hrv_weekly_avg, " ms")}
        subValue={formatHrvSubtext(metrics)}
      />
      <Factoid
        label="Sleep"
        value={formatSleepDuration(sleep?.duration_seconds)}
        subValue={sleep?.sleep_score != null ? `Score ${sleep.sleep_score}` : "No sleep data"}
      />
    </div>
  );
}
```

- [ ] **Step 4: Run the factoid tests to verify they pass**

Run:

```bash
cd frontend && npm test -- --run src/components/today/__tests__/health-factoids.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit health factoids**

Run:

```bash
git add frontend/src/components/today/health-factoids.tsx frontend/src/components/today/__tests__/health-factoids.test.tsx
git commit -m "feat(today): add health factoids"
```

## Task 4: Build Today Quick Add

**Files:**
- Create: `frontend/src/components/today/quick-add-today-action-form.tsx`
- Create: `frontend/src/components/today/__tests__/quick-add-today-action-form.test.tsx`

- [ ] **Step 1: Write failing quick-add tests**

Create `frontend/src/components/today/__tests__/quick-add-today-action-form.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { QuickAddTodayActionForm } from "../quick-add-today-action-form";

const mocks = vi.hoisted(() => ({
  createActionMutate: vi.fn(),
}));

vi.mock("@/hooks/use-actions", () => ({
  useCreateAction: () => ({
    mutate: mocks.createActionMutate,
    isPending: false,
  }),
}));

describe("QuickAddTodayActionForm", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 4, 15, 10, 0, 0));
    mocks.createActionMutate.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates a title-only action for today", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<QuickAddTodayActionForm />);

    await user.type(screen.getByPlaceholderText("What needs to happen today?"), "Buy groceries");
    await user.click(screen.getByRole("button", { name: /^add$/i }));

    expect(mocks.createActionMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Buy groceries",
        action_date: "2026-05-15",
        remind_at: undefined,
      }),
      expect.any(Object),
    );
  });

  it("creates a timed action for today when a time is selected", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<QuickAddTodayActionForm />);

    await user.type(screen.getByPlaceholderText("What needs to happen today?"), "Call dentist");
    await user.click(screen.getByRole("button", { name: /add time/i }));
    await user.click(screen.getByRole("button", { name: /^add$/i }));

    expect(mocks.createActionMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Call dentist",
        action_date: "2026-05-15",
        remind_at: expect.stringMatching(/^2026-05-15T09:00:00[+-]\d{2}:\d{2}$/),
      }),
      expect.any(Object),
    );
  });
});
```

- [ ] **Step 2: Run the quick-add tests to verify they fail**

Run:

```bash
cd frontend && npm test -- --run src/components/today/__tests__/quick-add-today-action-form.test.tsx
```

Expected: FAIL because `quick-add-today-action-form.tsx` does not exist.

- [ ] **Step 3: Implement quick-add-today-action-form.tsx**

Create `frontend/src/components/today/quick-add-today-action-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Clock, Flag, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TimePicker } from "@/components/ui/time-picker";
import { useCreateAction } from "@/hooks/use-actions";
import { localDateString, withLocalTzOffset } from "./today-action-utils";

export function QuickAddTodayActionForm() {
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);
  const createAction = useCreateAction();

  const today = localDateString();
  const canSubmit = title.trim().length > 0;

  const reset = () => {
    setTitle("");
    setTime("");
    setIsUrgent(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    createAction.mutate(
      {
        title: title.trim(),
        action_date: today,
        remind_at: time ? withLocalTzOffset(today, time) : undefined,
        is_urgent: isUrgent,
      },
      {
        onSuccess: () => {
          reset();
          toast.success("Action created");
        },
        onError: () => toast.error("Failed to create action"),
      },
    );
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="border-[1.5px] border-dashed border-[color:var(--line-2)] bg-transparent p-1.5 font-mono sm:p-3"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          placeholder="What needs to happen today?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoComplete="off"
          className="min-h-9 flex-1 border-0 bg-transparent px-0 font-mono text-[16px] italic shadow-none rounded-none placeholder:italic placeholder:text-[color:var(--ink-3)] focus-visible:border-0 focus-visible:ring-0 sm:min-h-10 md:text-[13px]"
        />
        <span className="hidden border border-[color:var(--line)] px-2 py-1 text-[10px] uppercase tracking-[1.5px] text-[color:var(--ink-3)] sm:inline-flex">
          Today
        </span>
        {time ? (
          <div className="flex items-center gap-1">
            <TimePicker value={time} onChange={setTime} />
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => setTime("")} title="Clear time">
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <Button type="button" variant="outline" className="justify-start" onClick={() => setTime("09:00")}>
            <Clock className="h-4 w-4 opacity-60 shrink-0" />
            <span className="text-sm">Add time</span>
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setIsUrgent(!isUrgent)}
          className={isUrgent ? "border-red-500 bg-red-500/10 text-red-500 hover:bg-red-500/20 hover:text-red-600" : ""}
          title={isUrgent ? "Remove urgent" : "Mark as urgent"}
        >
          <Flag className="h-4 w-4" fill={isUrgent ? "currentColor" : "none"} />
        </Button>
        <Button type="submit" disabled={!canSubmit || createAction.isPending} className="gap-1.5">
          <Plus className="h-4 w-4" />
          {createAction.isPending ? "Adding..." : "Add"}
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Run the quick-add tests to verify they pass**

Run:

```bash
cd frontend && npm test -- --run src/components/today/__tests__/quick-add-today-action-form.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit quick-add**

Run:

```bash
git add frontend/src/components/today/quick-add-today-action-form.tsx frontend/src/components/today/__tests__/quick-add-today-action-form.test.tsx
git commit -m "feat(today): add quick action capture"
```

## Task 5: Build Actions Today List

**Files:**
- Create: `frontend/src/components/today/actions-today.tsx`
- Create: `frontend/src/components/today/__tests__/actions-today.test.tsx`

- [ ] **Step 1: Write failing Actions Today tests**

Create `frontend/src/components/today/__tests__/actions-today.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Action } from "@/types/action";
import { ActionsToday } from "../actions-today";

const mocks = vi.hoisted(() => ({
  actions: [] as Action[],
  markDone: vi.fn(),
}));

vi.mock("@/hooks/use-actions", () => {
  const stub = () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false });
  return {
    useActions: () => ({ data: mocks.actions, isLoading: false, error: null }),
    useUpdateAction: stub,
    useDeleteAction: stub,
    useSnoozeAction: stub,
    useMarkActionDone: () => ({ mutate: mocks.markDone, isPending: false }),
  };
});

vi.mock("@/components/focus/start-focus-button", () => ({
  StartFocusButton: () => <button type="button">Focus</button>,
}));

function makeAction(overrides: Partial<Action> = {}): Action {
  return {
    id: 1,
    user_id: 1,
    title: "Pay rent",
    details: null,
    checklist: [],
    action_date: "2026-05-15",
    remind_at: null,
    mode: "anytime",
    status: "pending",
    snoozed_until: null,
    recurrence_rule: null,
    snooze_count: 0,
    notification_sent_count: 0,
    completed_at: null,
    is_floating: true,
    is_urgent: false,
    created_at: "2026-05-15T12:00:00Z",
    updated_at: "2026-05-15T12:00:00Z",
    ...overrides,
  };
}

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("ActionsToday", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 4, 15, 10, 0, 0));
    mocks.actions = [];
    mocks.markDone.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows pending actions for today and hides done, future, and inbox actions", () => {
    mocks.actions = [
      makeAction({ id: 1, title: "Today anytime" }),
      makeAction({ id: 2, title: "Today timed", remind_at: "2026-05-15T09:00:00-06:00", is_floating: false }),
      makeAction({ id: 3, title: "Done today", status: "done" }),
      makeAction({ id: 4, title: "Tomorrow", action_date: "2026-05-16" }),
      makeAction({ id: 5, title: "Inbox", action_date: null }),
    ];

    wrap(<ActionsToday />);

    expect(screen.getByText("Today timed")).toBeInTheDocument();
    expect(screen.getByText("Today anytime")).toBeInTheDocument();
    expect(screen.queryByText("Done today")).not.toBeInTheDocument();
    expect(screen.queryByText("Tomorrow")).not.toBeInTheDocument();
    expect(screen.queryByText("Inbox")).not.toBeInTheDocument();
  });

  it("expands a row and marks it done", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mocks.actions = [makeAction({ id: 10, title: "Write follow-up", details: "Send portfolio link" })];

    wrap(<ActionsToday />);
    await user.click(screen.getByRole("heading", { name: "Write follow-up" }));

    const row = screen.getByRole("heading", { name: "Write follow-up" }).closest("article");
    expect(within(row!).getByText("Send portfolio link")).toBeInTheDocument();
    expect(within(row!).queryByText("Focus")).not.toBeInTheDocument();

    await user.click(within(row!).getByRole("button", { name: /done/i }));
    expect(mocks.markDone).toHaveBeenCalledWith(10, expect.any(Object));
  });

  it("renders a compact empty state", () => {
    mocks.actions = [];
    wrap(<ActionsToday />);
    expect(screen.getByText("No actions today.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run Actions Today tests to verify they fail**

Run:

```bash
cd frontend && npm test -- --run src/components/today/__tests__/actions-today.test.tsx
```

Expected: FAIL because `actions-today.tsx` does not exist.

- [ ] **Step 3: Implement actions-today.tsx**

Create `frontend/src/components/today/actions-today.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import { ActionRow } from "@/components/actions/action-row";
import { useActions } from "@/hooks/use-actions";
import { actionBelongsToLocalDay, sortTodayActions } from "./today-action-utils";

export function ActionsToday() {
  const { data: actions = [], isLoading, error } = useActions(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const today = useMemo(
    () =>
      sortTodayActions(
        actions.filter(
          (action) =>
            action.status !== "done" && actionBelongsToLocalDay(action),
        ),
      ),
    [actions],
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-14 animate-pulse border-[1.5px] border-[color:var(--line)] bg-[color:var(--bg-2)]"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="border-[1.5px] border-[color:var(--line)] p-[14px_16px] text-[11.5px] text-[color:var(--accent-2)]">
        Failed to load actions.
      </div>
    );
  }

  if (today.length === 0) {
    return (
      <div className="border-[1.5px] border-[color:var(--line)] p-[14px_16px] text-[11.5px] text-[color:var(--ink-3)]">
        No actions today.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2" data-testid="actions-today">
      {today.map((action) => (
        <ActionRow
          key={action.id}
          action={action}
          expanded={expandedId === action.id}
          onToggle={() => setExpandedId(expandedId === action.id ? null : action.id)}
          showFocusButton={false}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run Actions Today tests to verify they pass**

Run:

```bash
cd frontend && npm test -- --run src/components/today/__tests__/actions-today.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit Actions Today**

Run:

```bash
git add frontend/src/components/today/actions-today.tsx frontend/src/components/today/__tests__/actions-today.test.tsx
git commit -m "feat(today): show expandable actions"
```

## Task 6: Replace Today Page Composition

**Files:**
- Modify: `frontend/src/app/(dashboard)/page.tsx`
- Rename: `frontend/src/app/(dashboard)/__tests__/page-plan-mode.test.tsx` to `frontend/src/app/(dashboard)/__tests__/today-redesign.test.tsx`

- [ ] **Step 1: Rewrite the Today page test for the new composition**

Move the old test file:

```bash
git mv 'frontend/src/app/(dashboard)/__tests__/page-plan-mode.test.tsx' 'frontend/src/app/(dashboard)/__tests__/today-redesign.test.tsx'
```

Replace its contents with:

```tsx
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import TodayPage from "../page";

vi.mock("@/hooks/use-vitals", () => ({
  useVitalsToday: () => ({
    data: {
      metrics: {
        id: 1,
        date: "2026-05-15",
        steps: null,
        distance_m: null,
        calories_active: null,
        calories_total: null,
        floors_climbed: null,
        intensity_minutes: null,
        resting_hr: null,
        avg_hr: null,
        max_hr: null,
        min_hr: null,
        avg_stress: null,
        max_stress: null,
        body_battery_high: null,
        body_battery_low: null,
        hrv_last_night_avg: 52,
        hrv_weekly_avg: 55,
        hrv_status: "BALANCED",
        vo2_max: null,
        training_readiness: 82,
        training_readiness_level: "READY",
        training_readiness_recovery_hours: 6,
        training_readiness_feedback: "Productive training is possible.",
      },
      sleep: {
        id: 1,
        date: "2026-05-15",
        duration_seconds: 26580,
        deep_seconds: null,
        light_seconds: null,
        rem_seconds: null,
        awake_seconds: null,
        sleep_score: 78,
        start_time: null,
        end_time: null,
      },
      recent_activities: [],
    },
    isLoading: false,
  }),
}));

vi.mock("@/components/today/quick-add-today-action-form", () => ({
  QuickAddTodayActionForm: () => <form data-testid="today-quick-add" />,
}));

vi.mock("@/components/today/actions-today", () => ({
  ActionsToday: () => <div data-testid="actions-today" />,
}));

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("Today page redesign", () => {
  it("renders health, quick-add, and actions today without planner chrome", () => {
    wrap(<TodayPage />);

    expect(screen.getByRole("heading", { name: "TODAY_" })).toBeInTheDocument();
    expect(screen.getByText("Training readiness")).toBeInTheDocument();
    expect(screen.getByText("HRV")).toBeInTheDocument();
    expect(screen.getByText("Sleep")).toBeInTheDocument();
    expect(screen.getByTestId("today-quick-add")).toBeInTheDocument();
    expect(screen.getByTestId("actions-today")).toBeInTheDocument();

    expect(screen.queryByText(/PLAN/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/FOCUS QUEUE/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Signals/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Response rate/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the new page test to verify it fails**

Run:

```bash
cd frontend && npm test -- --run 'src/app/(dashboard)/__tests__/today-redesign.test.tsx'
```

Expected: FAIL because `page.tsx` still renders planner-mode Today.

- [ ] **Step 3: Replace page.tsx**

Replace `frontend/src/app/(dashboard)/page.tsx` with:

```tsx
"use client";

import { useVitalsToday } from "@/hooks/use-vitals";
import { TodayHealthFactoids } from "@/components/today/health-factoids";
import { QuickAddTodayActionForm } from "@/components/today/quick-add-today-action-form";
import { ActionsToday } from "@/components/today/actions-today";

function Hdline({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 mt-[18px] mb-[12px]">
      <span className="text-[color:var(--accent)] text-[14px] leading-none" aria-hidden>
        |
      </span>
      <h3 className="font-[family-name:var(--font-space-grotesk)] font-bold text-[15px] tracking-[-0.2px] uppercase m-0 text-[color:var(--ink)]">
        {title}
      </h3>
      <div className="flex-1 h-px bg-[color:var(--line)]" />
    </div>
  );
}

export default function TodayPage() {
  const { data, isLoading } = useVitalsToday();

  return (
    <div className="flex flex-col gap-[14px]">
      <header className="border-b-[1.5px] border-[color:var(--line)] pb-[14px]">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="hidden text-[11px] uppercase tracking-[1.5px] text-[color:var(--ink-3)] font-mono sm:block">
              Module | Today
            </div>
            <h1 className="font-bold text-[22px] leading-none tracking-[-0.2px] text-[color:var(--ink)] sm:mt-1 sm:text-[28px] sm:leading-[1.1] sm:tracking-[-0.4px]">
              TODAY_
            </h1>
          </div>
        </div>
      </header>

      <TodayHealthFactoids
        metrics={data?.metrics ?? null}
        sleep={data?.sleep ?? null}
        isLoading={isLoading}
      />

      <QuickAddTodayActionForm />

      <div>
        <Hdline title="Actions today" />
        <ActionsToday />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run page and Today component tests**

Run:

```bash
cd frontend && npm test -- --run \
  'src/app/(dashboard)/__tests__/today-redesign.test.tsx' \
  src/components/today/today-action-utils.test.ts \
  src/components/today/__tests__/health-factoids.test.tsx \
  src/components/today/__tests__/quick-add-today-action-form.test.tsx \
  src/components/today/__tests__/actions-today.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit Today page replacement**

Run:

```bash
git add frontend/src/app/'(dashboard)'/page.tsx frontend/src/app/'(dashboard)'/__tests__/today-redesign.test.tsx
git commit -m "feat(today): simplify daily view"
```

## Task 7: Record Implementation Progress

**Files:**
- Modify: `docs/STATUS.md`

- [ ] **Step 1: Append implementation changes to docs/STATUS.md**

Append this section under `## Live Journal` after the code tasks are complete:

```md
### 2026-05-15 - Implementation

Changed:
- Extracted shared `ActionRow` from `ActionList`.
- Added Today action date utilities.
- Added Today health factoids.
- Added Today quick-add Action capture.
- Added expandable Actions Today list.
- Replaced the planner/dashboard Today composition with the health-first Today
  composition.

Validation:
- Focused Today/Actions tests: pending.
- Frontend lint: pending.
- Frontend production build: pending.
```

- [ ] **Step 2: Commit implementation journal**

Run:

```bash
git add docs/STATUS.md
git commit -m "docs: record Today redesign implementation"
```

## Task 8: Final Verification

**Files:**
- Validation-only task. Edit `docs/STATUS.md` only when recording command results.

- [ ] **Step 1: Run focused frontend suite**

Run:

```bash
cd frontend && npm test -- --run \
  src/components/actions/__tests__/action-list-groups.test.tsx \
  src/components/today/today-action-utils.test.ts \
  src/components/today/__tests__/health-factoids.test.tsx \
  src/components/today/__tests__/quick-add-today-action-form.test.tsx \
  src/components/today/__tests__/actions-today.test.tsx \
  'src/app/(dashboard)/__tests__/today-redesign.test.tsx'
```

Expected: PASS.

- [ ] **Step 2: Run lint**

Run:

```bash
cd frontend && npm run lint
```

Expected: PASS.

- [ ] **Step 3: Run production build**

Run:

```bash
cd frontend && npx next build --webpack
```

Expected: PASS.

- [ ] **Step 4: Update docs/STATUS.md with validation results**

Append exact commands and outcomes under the Today Redesign live journal.

- [ ] **Step 5: Commit validation journal**

Run:

```bash
git add docs/STATUS.md
git commit -m "docs: record Today redesign validation"
```

## Self-Review

- Spec coverage: health factoids are covered by Task 3; quick-add by Task 4; Actions Today list by Task 5; page noise removal by Task 6; active repo docs by Task 7; validation by Task 8.
- Red-flag scan: no task relies on implicit behavior; each task has exact files, commands, and expected outcomes.
- Type consistency: all new code uses existing `Action`, `VitalsDailyMetric`, `VitalsSleep`, `useActions`, `useCreateAction`, `useVitalsToday`, and existing `today-date` helper names.
