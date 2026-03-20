"use client";

import { Footprints, Heart, Moon, Brain, BatteryFull } from "lucide-react";
import type { VitalsDailyMetric, VitalsSleep } from "@/types/vitals";

interface TodaySummaryProps {
  metrics: VitalsDailyMetric | null | undefined;
  sleep: VitalsSleep | null | undefined;
  isLoading: boolean;
}

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  colorMuted: string;
}

function KpiCard({ icon, label, value, color, colorMuted }: KpiCardProps) {
  return (
    <div className="rounded-xl border border-border-subtle bg-card transition-colors duration-150 hover:bg-card-hover hover:border-border">
      <div className="p-[16px_18px]">
        <div className="flex items-start justify-between mb-[10px]">
          <span className="text-[12px] font-medium text-muted-foreground tracking-[0.01em]">
            {label}
          </span>
          <span
            className="flex h-[28px] w-[28px] items-center justify-center rounded-lg"
            style={{ color, background: colorMuted }}
          >
            {icon}
          </span>
        </div>
        <p
          className="text-[24px] font-semibold leading-none text-foreground"
          style={{ fontFeatureSettings: "'tnum'" }}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

function KpiCardSkeleton() {
  return (
    <div className="rounded-xl border border-border-subtle bg-card">
      <div className="p-[16px_18px]">
        <div className="flex items-start justify-between mb-[10px]">
          <div className="h-3 w-16 rounded bg-muted animate-pulse" />
          <div className="h-[28px] w-[28px] rounded-lg bg-muted animate-pulse" />
        </div>
        <div className="h-6 w-20 rounded bg-muted animate-pulse" />
      </div>
    </div>
  );
}

function formatSteps(steps: number | null): string {
  if (steps == null) return "\u2014";
  return steps.toLocaleString("en-US");
}

function formatSleepDuration(seconds: number | null): string {
  if (seconds == null) return "\u2014";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

function formatValue(val: number | null, suffix = ""): string {
  if (val == null) return "\u2014";
  return `${val}${suffix}`;
}

function formatBattery(high: number | null, low: number | null): string {
  if (high == null && low == null) return "\u2014";
  return `${high ?? "\u2014"} / ${low ?? "\u2014"}`;
}

const TEAL = "var(--accent-teal)";
const TEAL_MUTED = "var(--accent-teal-muted)";
const ROSE = "var(--destructive)";
const ROSE_MUTED = "var(--destructive-muted)";
const INDIGO = "var(--primary)";
const INDIGO_MUTED = "var(--accent-muted)";
const AMBER = "var(--accent-amber)";
const AMBER_MUTED = "var(--accent-amber-muted)";
const GREEN = "var(--accent-teal)";
const GREEN_MUTED = "var(--accent-teal-muted)";

export function TodaySummary({ metrics, sleep, isLoading }: TodaySummaryProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" data-testid="vitals-summary-loading">
        {Array.from({ length: 5 }).map((_, i) => (
          <KpiCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" data-testid="vitals-summary">
      <KpiCard
        icon={<Footprints size={14} />}
        label="Steps"
        value={formatSteps(metrics?.steps ?? null)}
        color={TEAL}
        colorMuted={TEAL_MUTED}
      />
      <KpiCard
        icon={<Heart size={14} />}
        label="Resting HR"
        value={formatValue(metrics?.resting_hr ?? null, " bpm")}
        color={ROSE}
        colorMuted={ROSE_MUTED}
      />
      <KpiCard
        icon={<Moon size={14} />}
        label="Sleep"
        value={formatSleepDuration(sleep?.duration_seconds ?? null)}
        color={INDIGO}
        colorMuted={INDIGO_MUTED}
      />
      <KpiCard
        icon={<Brain size={14} />}
        label="Avg Stress"
        value={formatValue(metrics?.avg_stress ?? null)}
        color={AMBER}
        colorMuted={AMBER_MUTED}
      />
      <KpiCard
        icon={<BatteryFull size={14} />}
        label="Body Battery"
        value={formatBattery(metrics?.body_battery_high ?? null, metrics?.body_battery_low ?? null)}
        color={GREEN}
        colorMuted={GREEN_MUTED}
      />
    </div>
  );
}
