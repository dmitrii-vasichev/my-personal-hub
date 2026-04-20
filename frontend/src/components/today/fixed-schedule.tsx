"use client";

import { usePlannerContext } from "@/hooks/use-planner-context";
import type { ContextEvent } from "@/types/plan";

function hhmm(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, "0")}:${d
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;
}

function durationMin(start: string, end: string): number {
  return Math.round(
    (new Date(end).getTime() - new Date(start).getTime()) / 60000,
  );
}

export function FixedSchedule() {
  const { context } = usePlannerContext();
  const events: ContextEvent[] = context?.calendar_events ?? [];
  if (events.length === 0) return null;

  const sorted = [...events].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
  );

  return (
    <section className="border border-[color:var(--line)]">
      <header className="border-b border-[color:var(--line)] px-3 py-2 text-[10.5px] uppercase tracking-[1.5px] text-[color:var(--ink-3)] font-mono">
        FIXED SCHEDULE · {sorted.length}
      </header>
      <ul className="divide-y divide-[color:var(--line)]">
        {sorted.map((e) => (
          <li
            key={e.id}
            className="flex items-center gap-3 px-3 py-2 font-mono text-[13px]"
          >
            <span className="w-12 text-[color:var(--ink-3)]">
              {hhmm(e.start)}
            </span>
            <span className="flex-1 truncate text-[color:var(--ink)]">
              {e.title}
            </span>
            <span className="text-[9.5px] uppercase tracking-[1.5px] text-[color:var(--ink-3)]">
              {durationMin(e.start, e.end)}m
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
