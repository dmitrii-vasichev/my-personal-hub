"use client";

import { useEffect, useMemo, useState } from "react";
import { ActionRow } from "@/components/actions/action-row";
import { useActions } from "@/hooks/use-actions";
import {
  localDateString,
  partitionDueTodayActions,
} from "./today-action-utils";
import type { Action } from "@/types/action";

const MIDNIGHT_ROLLOVER_BUFFER_MS = 1_000;

function dateFromLocalKey(todayKey: string): Date {
  const [year, month, day] = todayKey.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
}

function msUntilNextLocalDay(now = new Date()): number {
  const nextMidnight = new Date(now);
  nextMidnight.setDate(now.getDate() + 1);
  nextMidnight.setHours(0, 0, 0, 0);
  return Math.max(
    nextMidnight.getTime() - now.getTime() + MIDNIGHT_ROLLOVER_BUFFER_MS,
    MIDNIGHT_ROLLOVER_BUFFER_MS
  );
}

function ActionSection({
  id,
  title,
  count,
  overdue = false,
  actions,
  expandedId,
  onToggle,
}: {
  id: string;
  title: string;
  count: number;
  overdue?: boolean;
  actions: Action[];
  expandedId: number | null;
  onToggle: (id: number) => void;
}) {
  const tone = overdue
    ? "text-[color:var(--accent-2)]"
    : "text-[color:var(--ink)]";
  const mark = overdue
    ? "text-[color:var(--accent-2)]"
    : "text-[color:var(--accent)]";
  const badge = overdue
    ? "border-[color:var(--accent-2)] bg-[color:var(--accent-amber-muted)] text-[color:var(--accent-2)]"
    : "border-[color:var(--line)] bg-[color:var(--bg-2)] text-[color:var(--ink-3)]";

  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <span className={`${mark} text-[14px] leading-none`} aria-hidden>
          ▍
        </span>
        <h3
          id={id}
          className={`m-0 font-[family-name:var(--font-space-grotesk)] text-[13px] font-bold uppercase tracking-[-0.2px] ${tone}`}
        >
          {title}
          <span
            className={`ml-2 inline-block border px-1.5 py-0.5 align-middle font-mono text-[10px] font-normal tracking-normal ${badge}`}
          >
            {count}
          </span>
        </h3>
        <div className="h-px flex-1 bg-[color:var(--line)]" />
      </div>
      <div className="flex flex-col gap-2">
        {actions.map((action) => (
          <ActionRow
            key={action.id}
            action={action}
            overdue={overdue}
            showFocusButton={false}
            expanded={expandedId === action.id}
            onToggle={() => onToggle(action.id)}
          />
        ))}
      </div>
    </section>
  );
}

export function ActionsToday() {
  const { data: actions = [], isLoading, error } = useActions(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [todayKey, setTodayKey] = useState(() => localDateString());

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setTodayKey(localDateString());
      setExpandedId(null);
    }, msUntilNextLocalDay());

    return () => window.clearTimeout(timeout);
  }, [todayKey]);

  const todayRef = useMemo(() => dateFromLocalKey(todayKey), [todayKey]);

  const { overdue, today } = useMemo(
    () => partitionDueTodayActions(actions, todayRef),
    [actions, todayRef]
  );

  const toggle = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  if (isLoading) {
    return (
      <div className="space-y-2" aria-busy="true">
        <p className="text-[11px] uppercase tracking-[1.5px] font-mono text-[color:var(--ink-3)]">
          Loading today&apos;s actions
        </p>
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            data-testid="actions-today-skeleton"
            className="h-12 animate-pulse border-[1.5px] border-[color:var(--line)] bg-[color:var(--bg-2)]"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="border-[1.5px] border-[color:var(--line)] p-3 text-[11px] uppercase tracking-[1.5px] font-mono text-[color:var(--accent-2)]">
        Failed to load today&apos;s actions
      </div>
    );
  }

  if (overdue.length === 0 && today.length === 0) {
    return (
      <div className="border-[1.5px] border-[color:var(--line)] p-3 text-[11px] uppercase tracking-[1.5px] font-mono text-[color:var(--ink-3)]">
        No actions for today
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[18px]">
      {overdue.length > 0 && (
        <ActionSection
          id="today-overdue-heading"
          title="Просрочено"
          count={overdue.length}
          overdue
          actions={overdue}
          expandedId={expandedId}
          onToggle={toggle}
        />
      )}
      {today.length > 0 && (
        <ActionSection
          id="today-planned-heading"
          title="На сегодня"
          count={today.length}
          actions={today}
          expandedId={expandedId}
          onToggle={toggle}
        />
      )}
    </div>
  );
}
