"use client";

import type { VitalsDailyMetric, VitalsSleep } from "@/types/vitals";

interface TodayHealthFactoidsProps {
  metrics: VitalsDailyMetric | null | undefined;
  sleep: VitalsSleep | null | undefined;
  isLoading: boolean;
}

interface FactoidProps {
  label: string;
  value: string;
  subValue: string;
  title?: string;
}

function formatNumber(value: number | null | undefined, suffix = ""): string {
  if (value == null) return "--";
  return `${value}${suffix}`;
}

function formatSleepDuration(seconds: number | null | undefined): string {
  if (seconds == null) return "--";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

function formatReadinessSubtext(metrics: VitalsDailyMetric | null | undefined): string {
  const level = metrics?.training_readiness_level ?? null;
  const recovery = metrics?.training_readiness_recovery_hours ?? null;
  if (level && recovery != null) return `${level} - ${recovery}h recovery`;
  if (level) return level;
  if (recovery != null) return `${recovery}h recovery`;
  return "No readiness data";
}

function formatHrvSubtext(metrics: VitalsDailyMetric | null | undefined): string {
  const lastNight = metrics?.hrv_last_night_avg ?? null;
  const status = metrics?.hrv_status ?? null;
  if (lastNight != null && status) return `Last night ${lastNight} ms - ${status}`;
  if (lastNight != null) return `Last night ${lastNight} ms`;
  if (status) return status;
  return "No HRV data";
}

function Factoid({ label, value, subValue, title }: FactoidProps) {
  return (
    <div
      className="border-[1.5px] border-[color:var(--line)] bg-[color:var(--bg-2)] p-[14px] min-h-[96px]"
      title={title}
    >
      <span className="block text-[9.5px] tracking-[2px] uppercase text-[color:var(--ink-3)]">
        {label}
      </span>
      <div className="mt-3 font-[family-name:var(--font-space-grotesk)] font-bold text-[30px] leading-[1] text-[color:var(--ink)]">
        {value}
      </div>
      <div className="mt-2 text-[10.5px] uppercase tracking-[1px] text-[color:var(--ink-3)]">
        {subValue}
      </div>
    </div>
  );
}

export function TodayHealthFactoids({
  metrics,
  sleep,
  isLoading,
}: TodayHealthFactoidsProps) {
  if (isLoading) {
    return (
      <div
        className="grid grid-cols-1 gap-[10px] sm:grid-cols-3"
        data-testid="today-health-loading"
      >
        {["readiness", "hrv", "sleep"].map((key) => (
          <div
            key={key}
            className="h-[96px] animate-pulse border-[1.5px] border-[color:var(--line)] bg-[color:var(--bg-2)]"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-[10px] sm:grid-cols-3" data-testid="today-health">
      <Factoid
        label="Training readiness"
        value={formatNumber(metrics?.training_readiness)}
        subValue={formatReadinessSubtext(metrics)}
        title={metrics?.training_readiness_feedback ?? undefined}
      />
      <Factoid
        label="HRV"
        value={formatNumber(metrics?.hrv_weekly_avg, " ms")}
        subValue={formatHrvSubtext(metrics)}
      />
      <Factoid
        label="Sleep"
        value={formatSleepDuration(sleep?.duration_seconds)}
        subValue={sleep?.sleep_score != null ? `Score ${sleep.sleep_score}` : "No sleep data"}
      />
    </div>
  );
}
