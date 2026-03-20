"use client";

import { useState } from "react";
import { subDays, format } from "date-fns";
import { PeriodSelector, periodToDays, type Period } from "./period-selector";
import { StepsChart } from "./charts/steps-chart";
import { HeartRateChart } from "./charts/heart-rate-chart";
import { SleepChart } from "./charts/sleep-chart";
import { StressChart } from "./charts/stress-chart";
import { BodyBatteryChart } from "./charts/body-battery-chart";
import { useVitalsMetrics, useVitalsSleep } from "@/hooks/use-vitals";

export function ChartsSection() {
  const [period, setPeriod] = useState<Period>("7d");

  const days = periodToDays(period);
  const endDate = format(new Date(), "yyyy-MM-dd");
  const startDate = format(subDays(new Date(), days), "yyyy-MM-dd");

  const { data: metrics, isLoading: metricsLoading } = useVitalsMetrics(startDate, endDate);
  const { data: sleep, isLoading: sleepLoading } = useVitalsSleep(startDate, endDate);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-foreground">Trends</h2>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border-subtle bg-card p-4">
          <h3 className="mb-3 text-xs font-medium text-muted-foreground">Steps</h3>
          <StepsChart data={metrics} period={period} isLoading={metricsLoading} />
        </div>

        <div className="rounded-xl border border-border-subtle bg-card p-4">
          <h3 className="mb-3 text-xs font-medium text-muted-foreground">Resting Heart Rate</h3>
          <HeartRateChart data={metrics} period={period} isLoading={metricsLoading} />
        </div>

        <div className="rounded-xl border border-border-subtle bg-card p-4">
          <h3 className="mb-3 text-xs font-medium text-muted-foreground">Sleep Phases</h3>
          <SleepChart data={sleep} period={period} isLoading={sleepLoading} />
        </div>

        <div className="rounded-xl border border-border-subtle bg-card p-4">
          <h3 className="mb-3 text-xs font-medium text-muted-foreground">Stress Level</h3>
          <StressChart data={metrics} period={period} isLoading={metricsLoading} />
        </div>

        <div className="rounded-xl border border-border-subtle bg-card p-4 lg:col-span-2">
          <h3 className="mb-3 text-xs font-medium text-muted-foreground">Body Battery</h3>
          <BodyBatteryChart data={metrics} period={period} isLoading={metricsLoading} />
        </div>
      </div>
    </div>
  );
}
