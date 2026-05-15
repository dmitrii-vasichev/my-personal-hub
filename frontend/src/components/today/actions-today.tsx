"use client";

import { useEffect, useMemo, useState } from "react";
import { ActionRow } from "@/components/actions/action-row";
import { useActions } from "@/hooks/use-actions";
import {
  actionBelongsToLocalDay,
  localDateString,
  sortTodayActions,
} from "./today-action-utils";

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

  const todayActions = useMemo(
    () =>
      sortTodayActions(
        actions.filter(
          (action) =>
            action.status === "pending" &&
            actionBelongsToLocalDay(action, todayRef)
        )
      ),
    [actions, todayRef]
  );

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

  if (todayActions.length === 0) {
    return (
      <div className="border-[1.5px] border-[color:var(--line)] p-3 text-[11px] uppercase tracking-[1.5px] font-mono text-[color:var(--ink-3)]">
        No actions for today
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {todayActions.map((action) => (
        <ActionRow
          key={action.id}
          action={action}
          expanded={expandedId === action.id}
          onToggle={() =>
            setExpandedId(expandedId === action.id ? null : action.id)
          }
          showFocusButton={false}
        />
      ))}
    </div>
  );
}
