"use client";

import { useEffect, useMemo, useState } from "react";
import { useTasks } from "@/hooks/use-tasks";
import { useCalendarEvents } from "@/hooks/use-calendar";
import { useReminders } from "@/hooks/use-reminders";
import type { TaskPriority } from "@/types/task";
import { formatTime, isSameLocalDay, todayBounds } from "./today-date";
import { NowBlock } from "./now-block";

type TagCls = "default" | "warn" | "teal" | "acc";

type Row = {
  key: string;
  time: string;
  sortTime: number;
  title: string;
  sub: string;
  tag: string;
  tagClass: TagCls;
  done: boolean;
  p1: boolean;
};

function priorityTag(priority: TaskPriority): {
  label: string;
  cls: TagCls;
} {
  if (priority === "urgent") return { label: "P1", cls: "warn" };
  if (priority === "high") return { label: "P2", cls: "default" };
  if (priority === "medium") return { label: "P3", cls: "default" };
  return { label: "P4", cls: "default" };
}

export function DayTimeline() {
  const { startIso, endIso } = todayBounds();
  const { data: tasks = [] } = useTasks();
  const { data: events = [] } = useCalendarEvents({
    start: startIso,
    end: endIso,
  });
  const { data: reminders = [] } = useReminders(true);

  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];

    for (const t of tasks) {
      if (!t.deadline || !isSameLocalDay(t.deadline)) continue;
      const done = t.status === "done" || t.status === "cancelled";
      const tag = priorityTag(t.priority);
      out.push({
        key: `task-${t.id}`,
        time: formatTime(t.deadline),
        sortTime: new Date(t.deadline).getTime(),
        title: t.title,
        sub: t.description?.slice(0, 120) ?? "",
        tag: tag.label,
        tagClass: tag.cls,
        done,
        p1: t.priority === "urgent",
      });
    }

    for (const e of events) {
      const end = new Date(e.end_time).getTime();
      out.push({
        key: `event-${e.id}`,
        time: formatTime(e.start_time),
        sortTime: new Date(e.start_time).getTime(),
        title: e.title,
        sub: `${formatTime(e.end_time)} · ${e.location || "no location"}`,
        tag: "MEET",
        tagClass: "teal",
        done: end < now,
        p1: false,
      });
    }

    for (const r of reminders) {
      if (!isSameLocalDay(r.remind_at)) continue;
      const done = r.status === "done";
      out.push({
        key: `rem-${r.id}`,
        time: formatTime(r.remind_at),
        sortTime: new Date(r.remind_at).getTime(),
        title: r.title,
        sub: "",
        tag: r.recurrence_rule ? "RECUR" : "REMIND",
        tagClass: "default",
        done,
        p1: false,
      });
    }

    return out.sort((a, b) => a.sortTime - b.sortTime);
  }, [tasks, events, reminders, now]);

  if (rows.length === 0) {
    return (
      <div className="border-[1.5px] border-[color:var(--line)]">
        <NowBlock />
        <div className="p-[14px_16px] text-[11.5px] text-[color:var(--ink-3)]">
          Nothing on today&apos;s timeline.
        </div>
      </div>
    );
  }

  return (
    <div className="border-[1.5px] border-[color:var(--line)]">
      <NowBlock />
      {rows.map((r, i) => (
        <div
          key={r.key}
          className={`grid grid-cols-[64px_14px_1fr_auto] gap-[14px] items-center p-[10px_16px] hover:bg-[color:var(--bg-2)] ${
            i < rows.length - 1
              ? "border-b border-[color:var(--line)]"
              : ""
          } ${r.done ? "opacity-60" : ""}`}
        >
          <div
            className={`text-[11.5px] font-semibold tracking-[0.5px] ${
              r.p1
                ? "text-[color:var(--accent-2)]"
                : "text-[color:var(--ink-2)]"
            }`}
          >
            {r.time}
          </div>
          <div
            className={`w-2 h-2 ${
              r.p1
                ? "bg-[color:var(--accent-2)]"
                : r.done
                  ? "bg-transparent border-[1.5px] border-[color:var(--ink-4)]"
                  : "bg-[color:var(--ink-4)]"
            }`}
            aria-hidden
          />
          <div className="min-w-0">
            <div
              className={`font-[family-name:var(--font-space-grotesk)] font-semibold text-[14px] tracking-[-0.1px] truncate ${
                r.done
                  ? "line-through text-[color:var(--ink-3)] font-medium"
                  : "text-[color:var(--ink)]"
              }`}
            >
              {r.title}
            </div>
            {r.sub && (
              <div className="text-[11.5px] text-[color:var(--ink-3)] mt-0.5 leading-[1.4] truncate">
                {r.sub}
              </div>
            )}
          </div>
          <Tag tag={r.tag} cls={r.tagClass} />
        </div>
      ))}
    </div>
  );
}

function Tag({ tag, cls }: { tag: string; cls: TagCls }) {
  const base =
    "inline-block text-[9.5px] tracking-[1px] uppercase px-[6px] py-[2px] border";
  const variant = {
    default: "border-[color:var(--line-2)] text-[color:var(--ink-2)]",
    warn: "border-[color:var(--accent-2)] text-[color:var(--accent-2)]",
    teal: "border-[color:var(--accent-3)] text-[color:var(--accent-3)]",
    acc: "bg-[color:var(--accent)] text-[#0e0e0c] border-[color:var(--accent)]",
  }[cls];
  return <span className={`${base} ${variant}`}>{tag}</span>;
}
