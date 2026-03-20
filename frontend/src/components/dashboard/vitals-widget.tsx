"use client";

import { Activity, Footprints, Heart, Moon, Brain, BatteryFull } from "lucide-react";
import Link from "next/link";
import { useVitalsDashboardSummary } from "@/hooks/use-dashboard-vitals";
import type { VitalsDailyMetric, VitalsSleep } from "@/types/vitals";

function formatSteps(steps: number | null | undefined): string {
  if (steps == null) return "\u2014";
  return steps.toLocaleString("en-US");
}

function formatSleepDuration(seconds: number | null | undefined): string {
  if (seconds == null) return "\u2014";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (minutes === 0) return `${hours}h`;
  return `${hours}.${Math.round((minutes / 60) * 10)}h`;
}

function formatValue(val: number | null | undefined): string {
  if (val == null) return "\u2014";
  return String(val);
}

function formatBattery(high: number | null | undefined): string {
  if (high == null) return "\u2014";
  return String(high);
}

interface KpiRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  bg: string;
}

function KpiRow({ icon, label, value, color, bg }: KpiRowProps) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2.5">
        <span
          className="flex h-[26px] w-[26px] items-center justify-center rounded-lg"
          style={{ color, background: bg }}
        >
          {icon}
        </span>
        <span className="text-[13px] text-muted-foreground">{label}</span>
      </div>
      <span
        className="text-[14px] font-semibold text-foreground"
        style={{ fontFeatureSettings: "'tnum'" }}
      >
        {value}
      </span>
    </div>
  );
}

function WidgetSkeleton() {
  return (
    <div className="rounded-xl border border-border-subtle bg-card">
      <div className="border-b border-border-subtle px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-[28px] w-[28px] rounded-lg bg-muted animate-pulse" />
          <div className="h-4 w-14 rounded bg-muted animate-pulse" />
        </div>
      </div>
      <div className="px-4 py-3 space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-[26px] w-[26px] rounded-lg bg-muted animate-pulse" />
              <div className="h-3 w-16 rounded bg-muted animate-pulse" />
            </div>
            <div className="h-4 w-12 rounded bg-muted animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function VitalsWidget() {
  const { data: summary, isLoading } = useVitalsDashboardSummary();

  if (isLoading) {
    return <WidgetSkeleton />;
  }

  const connected = summary?.connected ?? false;
  const metrics: VitalsDailyMetric | null | undefined = summary?.metrics;
  const sleep: VitalsSleep | null | undefined = summary?.sleep;

  return (
    <div className="rounded-xl border border-border-subtle bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            className="flex h-[28px] w-[28px] items-center justify-center rounded-lg"
            style={{
              color: "var(--accent-teal)",
              background: "var(--accent-teal-muted)",
            }}
          >
            <Activity size={14} />
          </span>
          <span className="text-sm font-medium text-foreground">Vitals</span>
        </div>
        <Link
          href="/vitals"
          className="text-[12px] text-tertiary hover:text-muted-foreground transition-colors"
        >
          View details &rarr;
        </Link>
      </div>

      {/* Body */}
      {!connected ? (
        <div className="px-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            Connect Garmin in Settings
          </p>
        </div>
      ) : (
        <div className="px-4 py-3">
          <KpiRow
            icon={<Footprints size={13} />}
            label="Steps"
            value={formatSteps(metrics?.steps)}
            color="var(--accent-teal)"
            bg="var(--accent-teal-muted)"
          />
          <KpiRow
            icon={<Heart size={13} />}
            label="Resting HR"
            value={formatValue(metrics?.resting_hr)}
            color="var(--destructive)"
            bg="var(--destructive-muted)"
          />
          <KpiRow
            icon={<Moon size={13} />}
            label="Sleep"
            value={formatSleepDuration(sleep?.duration_seconds)}
            color="var(--primary)"
            bg="var(--accent-muted)"
          />
          <KpiRow
            icon={<BatteryFull size={13} />}
            label="Body Battery"
            value={formatBattery(metrics?.body_battery_high)}
            color="var(--accent-teal)"
            bg="var(--accent-teal-muted)"
          />
          <KpiRow
            icon={<Brain size={13} />}
            label="Avg Stress"
            value={formatValue(metrics?.avg_stress)}
            color="var(--accent-amber)"
            bg="var(--accent-amber-muted)"
          />
        </div>
      )}
    </div>
  );
}
