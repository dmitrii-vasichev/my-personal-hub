"use client";

import { useFocusSessionToday } from "@/hooks/use-focus-session";
import { formatFocusMinutes } from "@/types/focus-session";

export function FocusTodayCell() {
  const { data } = useFocusSessionToday();
  const totalMinutes = data?.total_minutes ?? 0;

  return (
    <>
      <div className="text-[9.5px] tracking-[2px] uppercase text-[color:var(--ink-3)]">
        Focus · today
      </div>
      <div
        className="font-[family-name:var(--font-space-grotesk)] font-bold text-[30px] leading-[1] tracking-[-1px] text-[color:var(--ink)]"
        aria-live="polite"
      >
        {formatFocusMinutes(totalMinutes)}
      </div>
    </>
  );
}
