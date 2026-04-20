"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useTasks, useUpdateTask } from "@/hooks/use-tasks";
import { useCalendarEvents } from "@/hooks/use-calendar";
import type { Task } from "@/types/task";
import type { CalendarEvent } from "@/types/calendar";
import { formatTime, isSameLocalDay, todayBounds } from "./today-date";

type PriorityTarget =
  | { kind: "task"; task: Task }
  | { kind: "meeting"; event: CalendarEvent }
  | { kind: "empty" };

function selectPriority(
  tasks: Task[],
  events: CalendarEvent[]
): PriorityTarget {
  const now = Date.now();

  const todayTasks = tasks
    .filter(
      (t) =>
        t.deadline &&
        t.status !== "done" &&
        t.status !== "cancelled" &&
        isSameLocalDay(t.deadline)
    )
    .sort(
      (a, b) =>
        new Date(a.deadline as string).getTime() -
        new Date(b.deadline as string).getTime()
    );

  const urgent = todayTasks.find((t) => t.priority === "urgent");
  if (urgent) return { kind: "task", task: urgent };
  if (todayTasks.length > 0) return { kind: "task", task: todayTasks[0] };

  const nextMeeting = events
    .filter((e) => new Date(e.start_time).getTime() >= now)
    .sort(
      (a, b) =>
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    )[0];
  if (nextMeeting) return { kind: "meeting", event: nextMeeting };

  return { kind: "empty" };
}

function useCountdown(targetIso: string | null | undefined): string {
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    if (!targetIso) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [targetIso]);
  if (!targetIso) return "";
  const target = new Date(targetIso).getTime();
  const diff = Math.max(0, target - now);
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);
  return `T-${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function HeroPriority() {
  const { startIso, endIso } = todayBounds();
  const { data: tasks = [] } = useTasks();
  const { data: events = [] } = useCalendarEvents({
    start: startIso,
    end: endIso,
  });
  const updateTask = useUpdateTask();

  const target = useMemo(
    () => selectPriority(tasks, events),
    [tasks, events]
  );

  const targetIso =
    target.kind === "task"
      ? target.task.deadline
      : target.kind === "meeting"
        ? target.event.start_time
        : null;
  const countdown = useCountdown(targetIso);

  if (target.kind === "empty") {
    return (
      <div className="p-[22px_24px] h-full">
        <div className="text-[10.5px] tracking-[2.5px] uppercase text-[color:var(--ink-3)] mb-[10px]">
          Priority_01
        </div>
        <h1 className="font-[family-name:var(--font-space-grotesk)] font-bold text-[32px] md:text-[42px] leading-[1.1] tracking-[-1.4px] m-0 text-[color:var(--ink-2)]">
          Today is quiet — nothing urgent.
        </h1>
      </div>
    );
  }

  const kicker =
    target.kind === "task" ? "Priority_01" : "Priority_01 · meeting";
  const title =
    target.kind === "task" ? target.task.title : target.event.title;
  const description =
    target.kind === "task"
      ? (target.task.description?.slice(0, 200) ?? "")
      : `${formatTime(target.event.start_time)}–${formatTime(target.event.end_time)} · ${target.event.location || "no location"}`;
  const openHref =
    target.kind === "task"
      ? `/tasks/${target.task.id}`
      : `/calendar/${target.event.id}`;
  const openLabel =
    target.kind === "task" ? "▶ Open task" : "▶ Open meeting";

  const handleSnooze = () => {
    if (target.kind !== "task" || !target.task.deadline) return;
    const newDeadline = new Date(
      new Date(target.task.deadline).getTime() + 3_600_000
    ).toISOString();
    updateTask.mutate({
      taskId: target.task.id,
      data: { deadline: newDeadline },
    });
  };

  return (
    <div className="p-[22px_24px] h-full flex flex-col">
      <div className="flex items-center gap-[10px] text-[10.5px] tracking-[2.5px] uppercase text-[color:var(--accent)] mb-[10px]">
        <span
          className="inline-block w-[6px] h-[6px] rounded-full bg-[color:var(--accent)]"
          style={{
            boxShadow: "0 0 8px var(--accent)",
            animation: "pulse 1.6s infinite",
          }}
          aria-hidden
        />
        <span>{kicker}</span>
        {countdown && <span>· {countdown}</span>}
      </div>
      <h1 className="font-[family-name:var(--font-space-grotesk)] font-bold text-[32px] md:text-[42px] leading-[1.1] tracking-[-1.4px] m-0 mb-[14px] uppercase text-[color:var(--ink)]">
        {title}
      </h1>
      {description && (
        <p className="text-[13px] text-[color:var(--ink-2)] leading-[1.5] mb-[18px] max-w-[540px]">
          {description}
        </p>
      )}
      <div className="flex gap-2 flex-wrap mt-auto">
        <Link
          href={openHref}
          className="inline-flex items-center h-8 px-3 border-[1.5px] border-[color:var(--accent)] bg-[color:var(--accent)] text-[#0e0e0c] text-[10.5px] tracking-[1.5px] uppercase font-bold hover:brightness-95"
        >
          {openLabel}
        </Link>
        {target.kind === "task" && (
          <button
            type="button"
            onClick={handleSnooze}
            disabled={updateTask.isPending}
            className="inline-flex items-center h-8 px-3 border-[1.5px] border-[color:var(--line-2)] bg-transparent text-[color:var(--ink)] text-[10.5px] tracking-[1.5px] uppercase hover:border-[color:var(--ink)] disabled:opacity-60"
          >
            ◷ Snooze 1h
          </button>
        )}
      </div>
    </div>
  );
}
