"use client";

import { usePlanAnalytics } from "@/hooks/use-plan-analytics";

export function PlanAdherenceCell() {
  const { current, deltaPct, isLoading } = usePlanAnalytics();

  const adh = current?.avg_adherence;
  const value = adh == null ? "—" : `${Math.round(adh * 100)}%`;
  const arrow = deltaPct == null ? null : deltaPct >= 0 ? "↑" : "↓";

  return (
    <>
      <div className="text-[9.5px] tracking-[2px] uppercase text-[color:var(--ink-3)]">
        Plan adherence · 7d
      </div>
      <div
        className="font-[family-name:var(--font-space-grotesk)] font-bold text-[30px] leading-[1] tracking-[-1px] text-[color:var(--ink)]"
        aria-live="polite"
      >
        {isLoading ? "…" : value}
      </div>
      {arrow && (
        <div className="text-[10px] text-[color:var(--ink-3)]">
          {arrow} {Math.abs(deltaPct!)}
        </div>
      )}
    </>
  );
}
