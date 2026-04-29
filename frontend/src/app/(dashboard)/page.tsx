"use client";

import { usePlanToday } from "@/hooks/use-plan-today";
import { useVisibilityRefetch } from "@/hooks/use-visibility-refetch";
import { PlanBar } from "@/components/today/plan-bar";
import { FocusQueue } from "@/components/today/focus-queue";
import { FixedSchedule } from "@/components/today/fixed-schedule";
import { NoPlanStrip } from "@/components/today/no-plan-strip";
import { PlanAdherenceCell } from "@/components/today/plan-adherence-cell";
import { FocusTodayCell } from "@/components/today/focus-today-cell";
import { NowBlock } from "@/components/today/now-block";
import { TodaySkeleton } from "@/components/today/today-skeleton";

import { HeroPriority } from "@/components/today/hero-priority";
import { HeroCells } from "@/components/today/hero-cells";
import { DayTimeline } from "@/components/today/day-timeline";
import { StatsGrid } from "@/components/today/stats-grid";
import { RemindersToday } from "@/components/today/reminders-today";
import { SignalsFeed } from "@/components/today/signals-feed";

function Hdline({
  title,
  action,
}: {
  title: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="flex items-center gap-3 mt-[22px] mb-[12px]">
      <span className="text-[color:var(--accent)] text-[14px] leading-none" aria-hidden>
        ▍
      </span>
      <h3 className="font-[family-name:var(--font-space-grotesk)] font-bold text-[15px] tracking-[-0.2px] uppercase m-0 text-[color:var(--ink)]">
        {title}
      </h3>
      <div className="flex-1 h-px bg-[color:var(--line)]" />
      {action && (
        <a
          href={action.href}
          className="text-[10.5px] tracking-[0.5px] text-[color:var(--ink-3)] hover:text-[color:var(--accent)]"
        >
          {action.label}
        </a>
      )}
    </div>
  );
}

const REFETCH_KEYS: readonly unknown[][] = [
  ["planner", "plans", "today"],
  ["planner", "context"],
  ["planner", "analytics", "7d"],
  ["planner", "analytics", "7d-prior"],
];

export default function TodayPage() {
  const { plan, hasPlan, isLoading } = usePlanToday();

  useVisibilityRefetch(REFETCH_KEYS);

  if (isLoading) return <TodaySkeleton />;

  if (hasPlan && plan) {
    return (
      <div>
        <PlanBar plan={plan} />

        <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-[18px] mt-[18px]">
          <div className="flex flex-col gap-[18px]">
            <NowBlock />
            <FocusQueue plan={plan} />
            <FixedSchedule />
          </div>
          <div className="flex flex-col gap-[18px]">
            <div className="border-[1.5px] border-[color:var(--line)]">
              <HeroCells />
            </div>
            <StatsGrid
              replaceResponseRateWith={<PlanAdherenceCell />}
              replaceTasksDoneWith={<FocusTodayCell />}
            />
            <RemindersToday />
          </div>
        </div>

        <Hdline title="Signals · Background" />
        <SignalsFeed />
      </div>
    );
  }

  return (
    <div>
      <NoPlanStrip />

      <div className="border-[1.5px] border-[color:var(--line)] grid grid-cols-1 md:grid-cols-[1.5fr_1fr] mt-[18px]">
        <div className="border-b-[1.5px] md:border-b-0 md:border-r-[1.5px] border-[color:var(--line)]">
          <HeroPriority />
        </div>
        <HeroCells />
      </div>

      <Hdline title="Timeline · Today" />
      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-[18px]">
        <DayTimeline />
        <div className="flex flex-col gap-[18px]">
          <StatsGrid
            replaceResponseRateWith={<PlanAdherenceCell />}
            replaceTasksDoneWith={<FocusTodayCell />}
          />
          <div>
            <Hdline title="Actions · Today" />
            <RemindersToday />
          </div>
        </div>
      </div>

      <Hdline title="Signals · Background" />
      <SignalsFeed />
    </div>
  );
}
