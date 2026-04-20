import type { DailyPlan, PlanItem } from "@/types/plan";
import { UNCHECKED_STATUSES } from "@/types/plan";

function pickNext(items: PlanItem[]): PlanItem | null {
  const sorted = [...items].sort((a, b) => a.order - b.order);
  return sorted.find((i) => UNCHECKED_STATUSES.includes(i.status)) ?? null;
}

export function PlanBar({ plan }: { plan: DailyPlan }) {
  const total = plan.items.length;
  const done = plan.items.filter(
    (i) => i.status === "done" || i.status === "skipped",
  ).length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const next = pickNext(plan.items);

  return (
    <section
      className="border-y border-[color:var(--line)] bg-[color:var(--bg-2)] px-4 py-3"
      aria-label="Today's plan progress"
    >
      <div className="flex items-center gap-4 text-[11px] uppercase tracking-[1.5px] text-[color:var(--ink-2)]">
        <span className="font-mono">PLAN · {plan.date}</span>
        <div
          className="relative h-1 flex-1 bg-[color:var(--line)]"
          role="progressbar"
          aria-valuenow={done}
          aria-valuemax={total}
        >
          <div
            className="absolute inset-y-0 left-0 bg-[color:var(--accent)]"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="font-mono">
          {done} / {total}
        </span>
        <span className="font-mono">
          {plan.completed_minutes} / {plan.planned_minutes}m
        </span>
      </div>

      <div className="mt-1 font-mono text-[13px] text-[color:var(--ink)]">
        {next ? (
          <>
            ▶ NEXT · {next.title} · {next.minutes_planned}m
          </>
        ) : (
          <span className="text-[color:var(--accent-3)]">
            ✓ All items complete for today.
          </span>
        )}
      </div>
    </section>
  );
}
