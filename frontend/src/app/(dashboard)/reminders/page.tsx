"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const focusQuickAdd = () => {
    quickAddRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Scroll to + focus the quick-add form when arriving via ?new=1 (from the
  // Command Palette). The palette routes to /reminders?new=1; this effect
  // completes the quick-action flow and scrubs the param.
  useEffect(() => {
    if (searchParams.get("new") !== "1") return;
    focusQuickAdd();
    requestAnimationFrame(() => {
      const input = document.getElementById("reminder-title") as HTMLInputElement | null;
      input?.focus();
    });
    const params = new URLSearchParams(searchParams.toString());
    params.delete("new");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [searchParams, pathname, router]);

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
    <div className="flex h-full flex-col gap-2.5 sm:gap-4">
      {/* Page header · brutalist .ph */}
      <header className="border-b-[1.5px] border-[color:var(--line)] pb-2 sm:pb-[14px]">
        <div className="flex items-center justify-between gap-3 sm:items-end sm:gap-4">
          <div className="min-w-0">
            <div className="hidden text-[11px] uppercase tracking-[1.5px] text-[color:var(--ink-3)] font-mono sm:block">
              Module · Reminders
            </div>
            <h1 className="font-bold text-[22px] leading-none tracking-[-0.2px] text-[color:var(--ink)] sm:mt-1 sm:text-[28px] sm:leading-[1.1] sm:tracking-[-0.4px]">
              REMINDERS_
            </h1>
            <p className="mt-1 hidden max-w-[34rem] text-[12px] text-[color:var(--ink-3)] font-mono sm:block">
              {sublineParts.join(" · ")}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setCompletedOpen(true)}
              className="h-8 border-[1.5px] border-[color:var(--line)] px-2.5 text-[10px] uppercase tracking-[1.2px] font-mono text-[color:var(--ink-3)] transition-colors hover:border-[color:var(--line-2)] hover:text-[color:var(--ink)] sm:h-9 sm:px-3 sm:text-[11px] sm:tracking-[1.5px]"
            >
              History
            </button>
          </div>
        </div>
      </header>

      {/* Tab navigation */}
      <RemindersTabs />

      {/* Two-column grid: reminders on left (1.7fr), birthdays aside on right (1fr) */}
      <div className="grid grid-cols-1 gap-[10px] md:grid-cols-[1.7fr_1fr] md:gap-[18px]">
        {/* LEFT — Quick add + reminder list */}
        <div className="flex flex-col gap-2.5 sm:gap-[14px]" ref={quickAddRef}>
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
