"use client";

import { ActionsToday } from "@/components/today/actions-today";
import { TodayHealthFactoids } from "@/components/today/health-factoids";
import { QuickAddTodayActionForm } from "@/components/today/quick-add-today-action-form";
import { useVisibilityRefetch } from "@/hooks/use-visibility-refetch";
import { useVitalsToday, VITALS_KEY } from "@/hooks/use-vitals";

const REFETCH_KEYS: readonly unknown[][] = [[VITALS_KEY, "today"]];

export default function TodayPage() {
  const { data: vitalsToday, isLoading: vitalsLoading } = useVitalsToday();

  useVisibilityRefetch(REFETCH_KEYS);

  return (
    <div className="flex flex-col gap-[18px]">
      <header className="border-b-[1.5px] border-[color:var(--line)] pb-[14px]">
        <h1 className="m-0 font-[family-name:var(--font-space-grotesk)] text-[28px] font-bold leading-none text-[color:var(--ink)]">
          Today
        </h1>
      </header>

      <section aria-label="Today health">
        <TodayHealthFactoids
          metrics={vitalsToday?.metrics}
          sleep={vitalsToday?.sleep}
          isLoading={vitalsLoading}
        />
      </section>

      <section className="flex flex-col gap-2" aria-label="Add action">
        <h2 className="m-0 font-mono text-[10px] uppercase tracking-[2px] text-[color:var(--ink-3)]">
          Add action
        </h2>
        <QuickAddTodayActionForm />
      </section>

      <section className="flex flex-col gap-2" aria-label="Actions Today">
        <h2 className="m-0 font-mono text-[10px] uppercase tracking-[2px] text-[color:var(--ink-3)]">
          Actions Today
        </h2>
        <ActionsToday />
      </section>
    </div>
  );
}
