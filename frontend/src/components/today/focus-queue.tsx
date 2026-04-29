"use client";

import type { DailyPlan, PlanItem } from "@/types/plan";
import { labelForCategory, UNCHECKED_STATUSES } from "@/types/plan";
import { useCompleteItemMutation } from "@/hooks/use-plan-today";
import { StartFocusButton } from "@/components/focus/start-focus-button";

type Mutate = ReturnType<typeof useCompleteItemMutation>["mutate"];

export function FocusQueue({ plan }: { plan: DailyPlan }) {
  const mutation = useCompleteItemMutation();
  const items = [...plan.items].sort((a, b) => a.order - b.order);

  return (
    <section className="border border-[color:var(--line)]">
      <header className="border-b border-[color:var(--line)] px-3 py-2 text-[10.5px] uppercase tracking-[1.5px] text-[color:var(--ink-3)] font-mono">
        FOCUS QUEUE · {items.length} items
      </header>
      <ul className="divide-y divide-[color:var(--line)]">
        {items.map((i) => (
          <li
            key={i.id}
            data-status={i.status}
            className={`flex items-center gap-3 px-3 py-2 font-mono text-[13px] ${
              i.status === "done" || i.status === "skipped"
                ? "opacity-60 line-through"
                : ""
            }`}
          >
            <Checkbox item={i} onToggle={() => handleClick(i, mutation.mutate)} />
            <span className="flex-1 truncate text-[color:var(--ink)]">
              {i.title}
            </span>
            <Chip>{i.minutes_planned}m</Chip>
            <Chip>{labelForCategory(i.category)}</Chip>
            {(i.status === "pending" || i.status === "rescheduled") && (
              <StartFocusButton planItemId={i.id} />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function handleClick(item: PlanItem, mutate: Mutate) {
  if (!UNCHECKED_STATUSES.includes(item.status)) return;
  mutate({
    id: item.id,
    body: { status: "done", minutes_actual: item.minutes_planned },
  });
}

function Checkbox({
  item,
  onToggle,
}: {
  item: PlanItem;
  onToggle: () => void;
}) {
  const isDone = item.status === "done";
  return (
    <label className="inline-flex items-center justify-center max-md:min-h-[44px] max-md:min-w-[44px] cursor-pointer">
      <input
        type="checkbox"
        checked={isDone}
        onChange={onToggle}
        aria-label={item.title}
        className="h-4 w-4 accent-[color:var(--accent)] cursor-pointer"
      />
    </label>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="border border-[color:var(--line-2)] px-1.5 py-0.5 text-[9.5px] uppercase tracking-[1.5px] text-[color:var(--ink-2)]">
      {children}
    </span>
  );
}
