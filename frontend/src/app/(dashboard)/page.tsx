"use client";

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

export default function TodayPage() {
  return (
    <div>
      {/* Hero — Priority + Cells */}
      <div className="border-[1.5px] border-[color:var(--line)] grid grid-cols-1 md:grid-cols-[1.5fr_1fr]">
        <div className="border-b-[1.5px] md:border-b-0 md:border-r-[1.5px] border-[color:var(--line)]">
          <HeroPriority />
        </div>
        <HeroCells />
      </div>

      <Hdline title="Timeline · Today" />
      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-[18px]">
        <DayTimeline />
        <div className="flex flex-col gap-[18px]">
          <StatsGrid />
          <div>
            <Hdline title="Reminders · Today" />
            <RemindersToday />
          </div>
        </div>
      </div>

      <Hdline title="Signals · Background" />
      <SignalsFeed />
    </div>
  );
}
