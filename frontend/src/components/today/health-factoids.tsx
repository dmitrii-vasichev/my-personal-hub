"use client";

import type { VitalsDailyMetric, VitalsSleep } from "@/types/vitals";

interface TodayHealthFactoidsProps {
  metrics: VitalsDailyMetric | null | undefined;
  sleep: VitalsSleep | null | undefined;
  isLoading: boolean;
}

interface FactoidProps {
  label: string;
  shortLabel?: string;
  value: string;
  subValue: string;
  compactSubValue?: string;
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

function formatCompactReadinessSubtext(metrics: VitalsDailyMetric | null | undefined): string {
  const level = metrics?.training_readiness_level ?? null;
  const recovery = metrics?.training_readiness_recovery_hours ?? null;
  if (level && recovery != null) return `${level} - ${recovery}h`;
  if (level) return level;
  if (recovery != null) return `${recovery}h recovery`;
  return "No data";
}

function formatHrvSubtext(metrics: VitalsDailyMetric | null | undefined): string {
  const lastNight = metrics?.hrv_last_night_avg ?? null;
  const status = metrics?.hrv_status ?? null;
  if (lastNight != null && status) return `Last night ${lastNight} ms - ${status}`;
  if (lastNight != null) return `Last night ${lastNight} ms`;
  if (status) return status;
  return "No HRV data";
}

function formatCompactHrvSubtext(metrics: VitalsDailyMetric | null | undefined): string {
  const lastNight = metrics?.hrv_last_night_avg ?? null;
  const status = metrics?.hrv_status ?? null;
  if (lastNight != null && status) return `${lastNight} - ${status}`;
  if (lastNight != null) return `Night ${lastNight}`;
  if (status) return status;
  return "No data";
}

function Factoid({
  label,
  shortLabel,
  value,
  subValue,
  compactSubValue,
  title,
}: FactoidProps) {
  return (
    <div
      className="min-h-[78px] border-[1.5px] border-[color:var(--line)] bg-[color:var(--bg-2)] p-[9px] sm:min-h-[96px] sm:p-[14px]"
      title={title}
    >
      <span className="block truncate text-[8.5px] uppercase tracking-[1.4px] text-[color:var(--ink-3)] sm:text-[9.5px] sm:tracking-[2px]">
        {shortLabel ? <span className="sm:hidden">{shortLabel}</span> : null}
        <span className={shortLabel ? "hidden sm:inline" : undefined}>
          {label}
        </span>
      </span>
      <div className="mt-2 whitespace-nowrap font-[family-name:var(--font-space-grotesk)] text-[21px] font-bold leading-[1] text-[color:var(--ink)] sm:mt-3 sm:text-[30px]">
        {value}
      </div>
      <div className="mt-2 truncate text-[8.5px] uppercase tracking-[0.8px] text-[color:var(--ink-3)] sm:text-[10.5px] sm:tracking-[1px]">
        {compactSubValue && compactSubValue !== subValue ? (
          <>
            <span className="sm:hidden">{compactSubValue}</span>
            <span className="hidden sm:inline">{subValue}</span>
          </>
        ) : (
          subValue
        )}
      </div>
    </div>
  );
}

function LoadingFactoid({ label }: { label: string }) {
  return (
    <div className="h-[78px] animate-pulse border-[1.5px] border-[color:var(--line)] bg-[color:var(--bg-2)] sm:h-[96px]">
      <span className="sr-only">
        {label}
      </span>
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
        className="grid grid-cols-3 gap-[6px] sm:gap-[10px]"
        data-testid="today-health-loading"
      >
        {["readiness", "hrv", "sleep"].map((key) => (
          <LoadingFactoid key={key} label={key} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-[6px] sm:gap-[10px]" data-testid="today-health">
      <Factoid
        label="Training readiness"
        shortLabel="Readiness"
        value={formatNumber(metrics?.training_readiness)}
        subValue={formatReadinessSubtext(metrics)}
        compactSubValue={formatCompactReadinessSubtext(metrics)}
        title={metrics?.training_readiness_feedback ?? undefined}
      />
      <Factoid
        label="HRV"
        value={formatNumber(metrics?.hrv_weekly_avg, " ms")}
        subValue={formatHrvSubtext(metrics)}
        compactSubValue={formatCompactHrvSubtext(metrics)}
      />
      <Factoid
        label="Sleep"
        value={formatSleepDuration(sleep?.duration_seconds)}
        subValue={sleep?.sleep_score != null ? `Score ${sleep.sleep_score}` : "No sleep data"}
        compactSubValue={sleep?.sleep_score != null ? `Score ${sleep.sleep_score}` : "No data"}
      />
    </div>
  );
}
