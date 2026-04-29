"use client";

import { useEffect, useMemo, useState } from "react";
import { useActions } from "@/hooks/use-actions";
import { useCalendarEvents } from "@/hooks/use-calendar";
import {
  formatTime,
  isSameLocalDay,
  parseLocalDateSource,
  todayBounds,
} from "./today-date";
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

export function DayTimeline() {
  const { startIso, endIso } = todayBounds();
  const { data: actions = [] } = useActions(true);
  const { data: events = [] } = useCalendarEvents({
    start: startIso,
    end: endIso,
  });

  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];

    for (const action of actions) {
      const source = action.remind_at ?? action.action_date;
      if (!source || !isSameLocalDay(source)) continue;
      const done = action.status === "done";
      const scheduled = Boolean(action.remind_at);
      const sourceDate = parseLocalDateSource(source);
      out.push({
        key: `action-${action.id}`,
        time: scheduled ? formatTime(action.remind_at) : "Anytime",
        sortTime: scheduled
          ? new Date(action.remind_at!).getTime()
          : (sourceDate?.setHours(23, 59, 59, 999) ?? Number.MAX_SAFE_INTEGER),
        title: action.title,
        sub: action.details?.slice(0, 120) ?? "",
        tag: action.is_urgent ? "P1" : action.recurrence_rule ? "RECUR" : "ACTION",
        tagClass: action.is_urgent ? "warn" : "default",
        done,
        p1: action.is_urgent,
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

    return out.sort((a, b) => a.sortTime - b.sortTime);
  }, [actions, events, now]);

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
