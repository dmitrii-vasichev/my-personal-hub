"use client";

import { useTasks } from "@/hooks/use-tasks";
import { useJobs } from "@/hooks/use-jobs";
import { useNotes } from "@/hooks/use-notes";
import { useDashboardSummary } from "@/hooks/use-dashboard";
import { daysAgo, isSameLocalDay } from "./today-date";

type Cell = {
  lab: string;
  val: number | string;
  unit?: string;
  delta?: string | null;
  bar?: number | null;
  alert?: boolean;
};

export function StatsGrid({
  replaceTasksDoneWith,
}: { replaceTasksDoneWith?: React.ReactNode } = {}) {
  const { data: tasks = [] } = useTasks();
  const { data: jobs = [] } = useJobs();
  const { data: notes = [] } = useNotes();
  const { data: summary } = useDashboardSummary();

  const overdue = summary?.tasks.overdue ?? 0;

  const thirty = daysAgo(30);
  const sixty = daysAgo(60);
  const notes30 = notes.filter((n) => new Date(n.created_at) >= thirty).length;
  const notesPrior30 = notes.filter((n) => {
    const d = new Date(n.created_at);
    return d >= sixty && d < thirty;
  }).length;
  const notesDelta = notes30 - notesPrior30;
  const notesDeltaLabel =
    notesDelta === 0
      ? null
      : notesDelta > 0
        ? `+${notesDelta} vs prior 30d`
        : `${notesDelta} vs prior 30d`;

  const applied30 = jobs.filter(
    (j) => j.applied_date && new Date(j.applied_date) >= thirty
  );
  const replied30 = applied30.filter(
    (j) => j.status && j.status !== "applied"
  );
  const replyRate =
    applied30.length > 0
      ? Math.round((replied30.length / applied30.length) * 100)
      : 0;

  const doneToday = tasks.filter(
    (t) => t.completed_at && isSameLocalDay(t.completed_at)
  ).length;

  const cells: Cell[] = [
    { lab: "Overdue tasks", val: overdue, alert: overdue > 0 },
    {
      lab: "Notes · 30d",
      val: notes30,
      delta: notesDeltaLabel,
    },
    {
      lab: "Response rate · 30d",
      val: replyRate,
      unit: "%",
      bar: replyRate,
    },
    { lab: "Tasks done · today", val: doneToday },
  ];

  return (
    <div className="grid grid-cols-2 grid-rows-2 border-[1.5px] border-[color:var(--line)]">
      {cells.map((c, i) => {
        const borderCls = `${i < 2 ? "border-b-[1.5px]" : ""} ${i % 2 === 0 ? "border-r-[1.5px]" : ""}`;
        const tileCls = `p-[14px] flex flex-col gap-1 min-h-[80px] justify-between border-[color:var(--line)] ${borderCls}`;

        if (c.lab === "Tasks done · today" && replaceTasksDoneWith) {
          return (
            <div key={c.lab} className={tileCls}>
              {replaceTasksDoneWith}
            </div>
          );
        }

        return (
          <div key={c.lab} className={tileCls}>
            <div className="text-[9.5px] tracking-[2px] uppercase text-[color:var(--ink-3)]">
              {c.lab}
            </div>
            <div
              className={`font-[family-name:var(--font-space-grotesk)] font-bold text-[30px] leading-[1] tracking-[-1px] ${c.alert ? "text-[color:var(--accent-2)]" : "text-[color:var(--ink)]"}`}
            >
              {c.val}
              {c.unit && (
                <span className="text-[11px] text-[color:var(--ink-3)] ml-1 font-medium">
                  {c.unit}
                </span>
              )}
            </div>
            {c.delta && (
              <div className="text-[10px] text-[color:var(--ink-3)]">
                {c.delta}
              </div>
            )}
            {c.bar !== undefined && c.bar !== null && (
              <div className="h-1.5 bg-[color:var(--bg-2)] border border-[color:var(--line)] relative mt-0.5">
                <div
                  className={`absolute left-0 top-0 bottom-0 ${c.alert ? "bg-[color:var(--accent-2)]" : "bg-[color:var(--accent)]"}`}
                  style={{ width: `${Math.min(100, c.bar)}%` }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
