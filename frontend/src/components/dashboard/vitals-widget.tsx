"use client";

import {
  Heart,
  Footprints,
  Moon,
  Activity,
  Zap,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { useVitalsDashboardSummary } from "@/hooks/use-vitals";

function formatSleepHours(seconds: number | null): string {
  if (!seconds) return "\u2014";
  return `${(seconds / 3600).toFixed(1)}h`;
}

function formatNumber(n: number | null | undefined): string {
  if (n == null) return "\u2014";
  return n.toLocaleString();
}

interface KpiItemProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  suffix?: string;
}

function KpiItem({ icon, label, value, suffix }: KpiItemProps) {
  return (
    <div className="px-4 py-2.5">
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-[11px] font-medium uppercase tracking-wide text-tertiary">
          {label}
        </span>
      </div>
      <p
        className="text-lg font-semibold text-foreground leading-tight"
        style={{ fontFeatureSettings: "'tnum'" }}
      >
        {value}
        {suffix && (
          <span className="text-xs font-normal text-tertiary ml-0.5">
            {suffix}
          </span>
        )}
      </p>
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
      <div className="grid grid-cols-2 gap-0">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`px-4 py-2.5 ${i <= 2 ? "border-b border-border-subtle" : ""}`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <div className="h-3.5 w-3.5 rounded bg-muted animate-pulse" />
              <div className="h-2.5 w-16 rounded bg-muted animate-pulse" />
            </div>
            <div className="h-5 w-12 rounded bg-muted animate-pulse" />
          </div>
        ))}
      </div>
      <div className="border-t border-border-subtle px-4 py-2.5">
        <div className="flex items-center gap-1.5 mb-1">
          <div className="h-3.5 w-3.5 rounded bg-muted animate-pulse" />
          <div className="h-2.5 w-16 rounded bg-muted animate-pulse" />
        </div>
        <div className="h-5 w-12 rounded bg-muted animate-pulse" />
      </div>
    </div>
  );
}

export function VitalsWidget() {
  const { data, isLoading } = useVitalsDashboardSummary();

  if (isLoading) {
    return <WidgetSkeleton />;
  }

  // Not connected state
  if (!data?.connected) {
    return (
      <div className="rounded-xl border border-border-subtle bg-card">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
          <div className="flex items-center gap-2">
            <span
              className="flex h-[28px] w-[28px] items-center justify-center rounded-lg"
              style={{
                color: "var(--destructive)",
                background: "var(--destructive-muted)",
              }}
            >
              <Heart size={14} />
            </span>
            <span className="text-sm font-medium text-foreground">Vitals</span>
          </div>
        </div>
        <div className="px-4 py-8 text-center">
          <AlertCircle className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground mb-1">
            No Garmin connected
          </p>
          <Link
            href="/settings"
            className="text-xs text-accent-foreground hover:underline"
          >
            Connect Garmin in Settings
          </Link>
        </div>
      </div>
    );
  }

  const { metrics, sleep } = data;

  return (
    <div className="rounded-xl border border-border-subtle bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            className="flex h-[28px] w-[28px] items-center justify-center rounded-lg"
            style={{
              color: "var(--destructive)",
              background: "var(--destructive-muted)",
            }}
          >
            <Heart size={14} />
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

      {/* KPI grid: 2 columns */}
      <div className="grid grid-cols-2 gap-0">
        <div className="border-b border-border-subtle border-r border-r-border-subtle">
          <KpiItem
            icon={<Zap size={14} />}
            label="Body Battery"
            value={formatNumber(metrics?.body_battery_high)}
            suffix="/ 100"
          />
        </div>
        <div className="border-b border-border-subtle">
          <KpiItem
            icon={<Footprints size={14} />}
            label="Steps"
            value={formatNumber(metrics?.steps)}
            suffix="/ 10,000"
          />
        </div>
        <div className="border-r border-r-border-subtle">
          <KpiItem
            icon={<Moon size={14} />}
            label="Sleep"
            value={formatSleepHours(sleep?.duration_seconds ?? null)}
          />
        </div>
        <div>
          <KpiItem
            icon={<Activity size={14} />}
            label="Resting HR"
            value={formatNumber(metrics?.resting_hr)}
            suffix="bpm"
          />
        </div>
      </div>

      {/* Fifth KPI full-width */}
      <div className="border-t border-border-subtle">
        <KpiItem
          icon={<Activity size={14} />}
          label="Stress"
          value={formatNumber(metrics?.avg_stress)}
          suffix="avg"
        />
      </div>
    </div>
  );
}
