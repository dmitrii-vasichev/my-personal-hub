"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ActionsTabs } from "@/components/actions/actions-tabs";
import { QuickAddActionForm } from "@/components/actions/quick-add-action-form";
import { ActionList } from "@/components/actions/action-list";
import { BirthdayList } from "@/components/reminders/birthday-list";
import { CompletedActionsSheet } from "@/components/actions/completed-actions-sheet";
import { useActions } from "@/hooks/use-actions";
import { useBirthdays } from "@/hooks/use-birthdays";
import { parseLocalDateSource } from "@/components/today/today-date";

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

export default function ActionsPage() {
  const { data: actions = [], isLoading, error } = useActions();
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

  useEffect(() => {
    if (searchParams.get("new") !== "1") return;
    focusQuickAdd();
    requestAnimationFrame(() => {
      const input = document.getElementById("action-title") as HTMLInputElement | null;
      input?.focus();
    });
    const params = new URLSearchParams(searchParams.toString());
    params.delete("new");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [searchParams, pathname, router]);

  const { todayCount, inboxCount, birthdaysSoon } = useMemo(() => {
    const now = new Date();
    const today0 = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).getTime();
    const tomorrow0 = today0 + 86_400_000;

    let today = 0;
    let inbox = 0;
    for (const action of actions) {
      if (action.status === "done") continue;
      if (!action.action_date && !action.remind_at) {
        inbox += 1;
        continue;
      }
      const source = action.action_date ?? action.remind_at;
      if (!source) continue;
      const t = parseLocalDateSource(source)?.getTime();
      if (!t) continue;
      if (t >= today0 && t < tomorrow0) today += 1;
    }

    const birthSoon = birthdays.filter(
      (b) => typeof b.days_until === "number" && b.days_until <= 14,
    ).length;

    return {
      todayCount: today,
      inboxCount: inbox,
      birthdaysSoon: birthSoon,
    };
  }, [actions, birthdays]);

  const sublineParts: string[] = [];
  sublineParts.push(`${todayCount} for today`);
  sublineParts.push(`${inboxCount} in inbox`);
  if (!biLoading && !biError) {
    sublineParts.push(`${birthdaysSoon} birthdays coming up`);
  }

  return (
    <div className="flex h-full flex-col gap-2.5 sm:gap-4">
      <header className="border-b-[1.5px] border-[color:var(--line)] pb-2 sm:pb-[14px]">
        <div className="flex items-center justify-between gap-3 sm:items-end sm:gap-4">
          <div className="min-w-0">
            <div className="hidden text-[11px] uppercase tracking-[1.5px] text-[color:var(--ink-3)] font-mono sm:block">
              Module · Actions
            </div>
            <h1 className="font-bold text-[22px] leading-none tracking-[-0.2px] text-[color:var(--ink)] sm:mt-1 sm:text-[28px] sm:leading-[1.1] sm:tracking-[-0.4px]">
              ACTIONS_
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

      <ActionsTabs />

      <div className="grid grid-cols-1 gap-[10px] md:grid-cols-[1.7fr_1fr] md:gap-[18px]">
        <div className="flex flex-col gap-2.5 sm:gap-[14px]" ref={quickAddRef}>
          <QuickAddActionForm />
          <ActionList
            actions={actions}
            isLoading={isLoading}
            error={error}
          />
        </div>

        <aside className="flex flex-col gap-[10px]">
          <Hdline title="Birthdays" count={birthdays.length} />
          <BirthdayList
            birthdays={birthdays}
            isLoading={biLoading}
            error={biError}
            limit={3}
          />
          <Link
            href="/actions/birthdays"
            className="self-start text-[11px] uppercase tracking-[1.5px] font-mono text-[color:var(--ink-3)] hover:text-[color:var(--accent)]"
          >
            See all -&gt;
          </Link>
        </aside>
      </div>

      <CompletedActionsSheet
        open={completedOpen}
        onOpenChange={setCompletedOpen}
      />
    </div>
  );
}
