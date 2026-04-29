"use client";

import { useActions } from "@/hooks/use-actions";
import { formatTime, isSameLocalDay } from "./today-date";

export function RemindersToday() {
  const { data: actions = [] } = useActions(false);
  const today = actions
    .filter((action) => {
      const source = action.remind_at ?? action.action_date;
      return source ? isSameLocalDay(source) : false;
    })
    .sort(
      (a, b) =>
        (a.remind_at ? new Date(a.remind_at).getTime() : Number.MAX_SAFE_INTEGER) -
        (b.remind_at ? new Date(b.remind_at).getTime() : Number.MAX_SAFE_INTEGER)
    )
    .slice(0, 5);

  if (today.length === 0) {
    return (
      <div className="border-[1.5px] border-[color:var(--line)] p-[14px_16px] text-[11.5px] text-[color:var(--ink-3)]">
        No actions today.
      </div>
    );
  }

  return (
    <div className="border-[1.5px] border-[color:var(--line)]">
      {today.map((r, i) => (
        <div
          key={r.id}
          className={`flex items-center gap-3 p-[10px_14px] ${i < today.length - 1 ? "border-b border-[color:var(--line)]" : ""}`}
        >
          <div className="text-[11.5px] font-semibold text-[color:var(--ink-2)] tracking-[0.5px] w-[48px] shrink-0">
            {r.remind_at ? formatTime(r.remind_at) : "Anytime"}
          </div>
          <div className="text-[12px] text-[color:var(--ink)] flex-1 min-w-0 truncate">
            {r.title}
          </div>
          {r.recurrence_rule && (
            <span className="text-[9.5px] tracking-[1px] uppercase px-[6px] py-[2px] border border-[color:var(--line-2)] text-[color:var(--ink-2)] shrink-0">
              RECUR
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
