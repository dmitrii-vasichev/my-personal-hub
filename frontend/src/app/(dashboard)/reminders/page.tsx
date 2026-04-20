"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { RemindersTabs } from "@/components/reminders/reminders-tabs";
import { QuickAddForm } from "@/components/reminders/quick-add-form";
import { ReminderList } from "@/components/reminders/reminder-list";
import { BirthdayList } from "@/components/reminders/birthday-list";
import { CompletedRemindersSheet } from "@/components/reminders/completed-reminders-sheet";
import { useReminders } from "@/hooks/use-reminders";
import { useBirthdays } from "@/hooks/use-birthdays";

function Hdline({ title, count }: { title: string; count?: number }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="text-[color:var(--accent)] text-[14px] leading-none"
        aria-hidden
      >
        ▍
      </span>
      <h3 className="font-[family-name:var(--font-space-grotesk)] font-bold text-[13px] tracking-[-0.2px] uppercase m-0 text-[color:var(--ink)]">
        {title}
      </h3>
      {typeof count === "number" && (
        <span className="border border-[color:var(--line)] bg-[color:var(--bg-2)] px-1.5 py-0.5 text-[10px] text-[color:var(--ink-3)] font-mono">
          {count}
        </span>
      )}
      <div className="flex-1 h-px bg-[color:var(--line)]" />
    </div>
  );
}

export default function RemindersPage() {
  const { data: reminders = [], isLoading, error } = useReminders();
  const {
    data: birthdays = [],
    isLoading: biLoading,
    error: biError,
  } = useBirthdays();
  const [completedOpen, setCompletedOpen] = useState(false);
  const quickAddRef = useRef<HTMLDivElement>(null);

  const scrollToQuickAdd = () => {
    quickAddRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Subline counts — derived from hook data.
  const { todayCount, floatingThisWeek, birthdaysSoon } = useMemo(() => {
    const now = new Date();
    const today0 = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).getTime();
    const tomorrow0 = today0 + 86_400_000;
    const weekEnd0 = today0 + 7 * 86_400_000;

    let today = 0;
    let floatWeek = 0;
    for (const r of reminders) {
      if (r.status === "done") continue;
      if (!r.remind_at) continue;
      const t = new Date(r.remind_at).getTime();
      if (t >= today0 && t < tomorrow0) today += 1;
      if (r.is_floating && t >= today0 && t < weekEnd0) floatWeek += 1;
    }

    const birthSoon = birthdays.filter(
      (b) => typeof b.days_until === "number" && b.days_until <= 14,
    ).length;

    return {
      todayCount: today,
      floatingThisWeek: floatWeek,
      birthdaysSoon: birthSoon,
    };
  }, [reminders, birthdays]);

  const sublineParts: string[] = [];
  sublineParts.push(`${todayCount} for today`);
  sublineParts.push(`${floatingThisWeek} floating this week`);
  // DATA-MAP: omit birthdays clause if hook hasn't produced usable data yet.
  if (!biLoading && !biError) {
    sublineParts.push(`${birthdaysSoon} birthdays coming up`);
  }

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Page header · brutalist .ph */}
      <header className="border-b-[1.5px] border-[color:var(--line)] pb-[14px]">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[1.5px] text-[color:var(--ink-3)] font-mono">
              Module · Reminders
            </div>
            <h1 className="mt-1 font-bold text-[28px] leading-[1.1] tracking-[-0.4px] text-[color:var(--ink)]">
              REMINDERS_
            </h1>
            <p className="mt-1 text-[12px] text-[color:var(--ink-3)] font-mono">
              {sublineParts.join(" · ")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCompletedOpen(true)}
              className="border-[1.5px] border-[color:var(--line)] px-3 py-1.5 text-[11px] uppercase tracking-[1.5px] font-mono text-[color:var(--ink-3)] hover:text-[color:var(--ink)] hover:border-[color:var(--line-2)] transition-colors"
            >
              History
            </button>
            <button
              type="button"
              onClick={scrollToQuickAdd}
              className="border-[1.5px] border-[color:var(--accent)] bg-[color:var(--accent)] px-3 py-1.5 text-[11px] uppercase tracking-[1.5px] text-[color:var(--bg)] font-mono font-bold"
            >
              + Quick Add
            </button>
          </div>
        </div>
      </header>

      {/* Tab navigation */}
      <RemindersTabs />

      {/* Two-column grid: reminders on left (1.7fr), birthdays aside on right (1fr) */}
      <div className="grid grid-cols-1 md:grid-cols-[1.7fr_1fr] gap-[18px]">
        {/* LEFT — Quick add + reminder list */}
        <div className="flex flex-col gap-[14px]" ref={quickAddRef}>
          <QuickAddForm />
          <ReminderList
            reminders={reminders}
            isLoading={isLoading}
            error={error}
          />
        </div>

        {/* RIGHT — Compact birthdays aside (top 3) */}
        <aside className="flex flex-col gap-[10px]">
          <Hdline title="Birthdays" count={birthdays.length} />
          <BirthdayList
            birthdays={birthdays}
            isLoading={biLoading}
            error={biError}
            limit={3}
          />
          <Link
            href="/reminders/birthdays"
            className="self-start text-[11px] uppercase tracking-[1.5px] font-mono text-[color:var(--ink-3)] hover:text-[color:var(--accent)]"
          >
            See all →
          </Link>
        </aside>
      </div>

      <CompletedRemindersSheet
        open={completedOpen}
        onOpenChange={setCompletedOpen}
      />
    </div>
  );
}
