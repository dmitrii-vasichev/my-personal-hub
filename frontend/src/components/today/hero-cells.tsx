"use client";

import { useTasks } from "@/hooks/use-tasks";
import { useJobs } from "@/hooks/use-jobs";
import { useCalendarEvents } from "@/hooks/use-calendar";
import { usePulseUnreadCount } from "@/hooks/use-pulse-digest-items";
import {
  daysAgo,
  thisWeekBounds,
  todayStart,
} from "./today-date";

const APPS_LIVE_STATUSES = new Set([
  "applied",
  "screening",
  "technical_interview",
  "final_interview",
  "offer",
]);

type Cell = {
  lab: string;
  val: number;
  delta: string | null;
  deltaColor?: "orange" | "teal";
};

export function HeroCells() {
  const { startIso: weekStartIso, endIso: weekEndIso } = thisWeekBounds();
  const { data: tasks = [] } = useTasks();
  const { data: jobs = [] } = useJobs();
  const { data: weekEvents = [] } = useCalendarEvents({
    start: weekStartIso,
    end: weekEndIso,
  });
  const { data: pulseUnread } = usePulseUnreadCount();

  const today0 = todayStart().getTime();

  const openTasks = tasks.filter(
    (t) => t.status !== "done" && t.status !== "cancelled"
  ).length;
  const overdue = tasks.filter(
    (t) =>
      t.deadline &&
      t.status !== "done" &&
      t.status !== "cancelled" &&
      new Date(t.deadline).getTime() < today0
  ).length;

  const interviewsThisWeek = weekEvents.filter(
    (e) => e.job_id != null
  ).length;

  const appsLive = jobs.filter(
    (j) => j.status && APPS_LIVE_STATUSES.has(j.status)
  ).length;

  const thirty = daysAgo(30);
  const applied30 = jobs.filter(
    (j) => j.applied_date && new Date(j.applied_date) >= thirty
  );
  const replied30 = applied30.filter(
    (j) => j.status && j.status !== "applied"
  );
  const replyRate =
    applied30.length > 0
      ? Math.round((replied30.length / applied30.length) * 100)
      : null;

  const pulseUnreadCount = pulseUnread?.unread_count ?? 0;

  const cells: Cell[] = [
    {
      lab: "Open tasks",
      val: openTasks,
      delta: overdue > 0 ? `${overdue} overdue` : null,
      deltaColor: overdue > 0 ? "orange" : undefined,
    },
    { lab: "Interviews this week", val: interviewsThisWeek, delta: null },
    {
      lab: "Apps live",
      val: appsLive,
      delta: replyRate !== null ? `↑ ${replyRate}% reply rate` : null,
      deltaColor: "teal",
    },
    { lab: "Pulse unread", val: pulseUnreadCount, delta: null },
  ];

  return (
    <div className="grid grid-cols-2 grid-rows-2 h-full">
      {cells.map((c, i) => (
        <div
          key={c.lab}
          className={`p-[14px_16px] flex flex-col justify-between min-h-[72px] border-[color:var(--line)] ${i < 2 ? "border-b-[1.5px]" : ""} ${i % 2 === 0 ? "border-r-[1.5px]" : ""}`}
        >
          <div className="text-[9.5px] tracking-[2px] uppercase text-[color:var(--ink-3)]">
            {c.lab}
          </div>
          <div>
            <div className="font-[family-name:var(--font-space-grotesk)] font-bold text-[26px] leading-[1] tracking-[-0.8px] text-[color:var(--ink)]">
              {c.val}
            </div>
            {c.delta && (
              <div
                className={`text-[10px] mt-0.5 ${
                  c.deltaColor === "orange"
                    ? "text-[color:var(--accent-2)]"
                    : c.deltaColor === "teal"
                      ? "text-[color:var(--accent-3)]"
                      : "text-[color:var(--ink-3)]"
                }`}
              >
                {c.delta}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
