"use client";

import { useMemo, useState } from "react";
import {
  format,
  parseISO,
  startOfDay,
} from "date-fns";
import { Bell } from "lucide-react";
import type { Action } from "@/types/action";
import { ActionRow } from "./action-row";

// -- Date grouping --

interface DateGroup {
  label: string;
  sortKey: number;
  actions: Action[];
}

function actionDay(action: Action): Date | null {
  const source = action.action_date ?? action.remind_at;
  if (!source) return null;
  return startOfDay(parseISO(source));
}

function groupByDate(actions: Action[], todayInput: Date = new Date()): DateGroup[] {
  const groups = new Map<string, DateGroup>();
  const today = startOfDay(todayInput);

  for (const action of actions) {
    const day = actionDay(action);
    const key = day ? (day < today ? "overdue" : day.toISOString()) : "inbox";

    let label: string;
    let sortKey: number;
    if (!day) {
      label = "Inbox/Someday";
      sortKey = Number.MAX_SAFE_INTEGER;
    } else if (day < today) {
      label = "Overdue";
      sortKey = Number.MIN_SAFE_INTEGER;
    } else if (day.getTime() === today.getTime()) {
      label = "Today";
      sortKey = day.getTime();
    } else {
      label = format(day, "MMMM d, yyyy");
      sortKey = day.getTime();
    }

    if (!groups.has(key)) {
      groups.set(key, { label, sortKey, actions: [] });
    }
    groups.get(key)!.actions.push(action);
  }

  const sorted = Array.from(groups.values()).sort(
    (a, b) => a.sortKey - b.sortKey
  );
  for (const g of sorted) {
    g.actions.sort((a, b) => {
      const aScheduled = a.remind_at ? 0 : 1;
      const bScheduled = b.remind_at ? 0 : 1;
      if (aScheduled !== bScheduled) return aScheduled - bScheduled;

      if (a.remind_at && b.remind_at) {
        return new Date(a.remind_at).getTime() - new Date(b.remind_at).getTime();
      }

      const aUrgent = a.is_urgent ? 0 : 1;
      const bUrgent = b.is_urgent ? 0 : 1;
      if (aUrgent !== bUrgent) return aUrgent - bUrgent;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }
  return sorted;
}

// -- Main list component --

interface ActionListProps {
  actions: Action[];
  today?: Date;
  isLoading: boolean;
  error: Error | null;
}

export function ActionList({ actions, today, isLoading, error }: ActionListProps) {
  const groups = useMemo(() => groupByDate(actions, today), [actions, today]);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
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
      <div className="flex flex-1 items-center justify-center text-[11px] uppercase tracking-[1.5px] font-mono text-[color:var(--accent-2)]">
        Failed to load actions
      </div>
    );
  }

  if (actions.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center border-[1.5px] border-[color:var(--line)] bg-[color:var(--bg-2)]">
          <Bell className="h-5 w-5 text-[color:var(--ink-3)]" />
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[1.5px] font-mono text-[color:var(--ink-3)]">
            No actions
          </p>
          <p className="mt-1 text-[10px] font-mono text-[color:var(--ink-3)]">
            Use the form above to create your first action
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[18px]">
      {groups.map((group) => (
        <section key={group.label} className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <span
              className="text-[color:var(--accent)] text-[14px] leading-none"
              aria-hidden
            >
              ▍
            </span>
            <h3 className="font-[family-name:var(--font-space-grotesk)] font-bold text-[13px] tracking-[-0.2px] uppercase m-0 text-[color:var(--ink)]">
              {group.label}
            </h3>
            <span className="border border-[color:var(--line)] bg-[color:var(--bg-2)] px-1.5 py-0.5 text-[10px] text-[color:var(--ink-3)] font-mono">
              {group.actions.length}
            </span>
            <div className="flex-1 h-px bg-[color:var(--line)]" />
          </div>
          <div className="flex flex-col gap-2">
            {group.actions.map((action) => (
              <ActionRow
                key={action.id}
                action={action}
                expanded={expandedId === action.id}
                onToggle={() => setExpandedId(expandedId === action.id ? null : action.id)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
