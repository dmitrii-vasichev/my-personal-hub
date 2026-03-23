"use client";

import {
  Heart,
  Footprints,
  Moon,
  Activity,
  Zap,
  AlertCircle,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import { useVitalsDashboardSummary } from "@/hooks/use-vitals";
import { useAuth } from "@/lib/auth";
import type { VitalsDailyMetric, VitalsSleep } from "@/types/vitals";

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

function StepsSparkline({ data }: { data: VitalsDailyMetric[] }) {
  const chartData = data.map((m) => ({
    date: format(new Date(m.date), "MMM d"),
    steps: m.steps ?? 0,
  }));

  if (chartData.length === 0) return null;

  return (
    <div className="px-4 pt-1 pb-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Footprints size={12} className="text-muted-foreground" />
        <span className="text-[10px] font-medium uppercase tracking-wide text-tertiary">
          Steps — 7 days
        </span>
      </div>
      <ResponsiveContainer width="100%" height={64}>
        <AreaChart data={chartData} margin={{ top: 2, right: 4, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id="stepsGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent-teal)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="var(--accent-teal)" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <XAxis dataKey="date" hide />
          <Tooltip
            formatter={(v) => [`${Number(v).toLocaleString()}`, "Steps"]}
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 11,
              padding: "4px 8px",
            }}
            labelStyle={{ fontSize: 10, color: "var(--text-tertiary)" }}
          />
          <Area
            type="monotone"
            dataKey="steps"
            stroke="var(--accent-teal)"
            strokeWidth={1.5}
            fill="url(#stepsGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function SleepSparkline({ data }: { data: VitalsSleep[] }) {
  const chartData = data.map((s) => ({
    date: format(new Date(s.date), "MMM d"),
    hours: s.duration_seconds ? Math.round((s.duration_seconds / 3600) * 10) / 10 : 0,
  }));

  if (chartData.length === 0) return null;

  return (
    <div className="px-4 pt-1 pb-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Moon size={12} className="text-muted-foreground" />
        <span className="text-[10px] font-medium uppercase tracking-wide text-tertiary">
          Sleep — 7 days
        </span>
      </div>
      <ResponsiveContainer width="100%" height={64}>
        <BarChart data={chartData} margin={{ top: 2, right: 4, left: 4, bottom: 0 }}>
          <XAxis dataKey="date" hide />
          <Tooltip
            formatter={(v) => [`${Number(v).toFixed(1)}h`, "Sleep"]}
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 11,
              padding: "4px 8px",
            }}
            labelStyle={{ fontSize: 10, color: "var(--text-tertiary)" }}
          />
          <Bar dataKey="hours" fill="#6366f1" radius={[2, 2, 0, 0]} opacity={0.8} />
        </BarChart>
      </ResponsiveContainer>
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
      {/* Sparkline skeletons */}
      <div className="border-t border-border-subtle grid grid-cols-2 gap-0">
        <div className="px-4 pt-1 pb-3 border-r border-r-border-subtle">
          <div className="h-2.5 w-20 rounded bg-muted animate-pulse mb-1.5" />
          <div className="h-[64px] rounded bg-muted animate-pulse" />
        </div>
        <div className="px-4 pt-1 pb-3">
          <div className="h-2.5 w-20 rounded bg-muted animate-pulse mb-1.5" />
          <div className="h-[64px] rounded bg-muted animate-pulse" />
        </div>
      </div>
    </div>
  );
}

export function VitalsWidget() {
  const { isDemo } = useAuth();
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

  const { metrics, sleep, metrics_7d, sleep_7d } = data;

  // Stale data detection: last sync > 2x sync interval
  const isDataStale = !isDemo
    && data.last_sync_at != null
    && data.sync_interval_minutes != null
    && new Date().getTime() - new Date(data.last_sync_at).getTime()
      > 2 * data.sync_interval_minutes * 60 * 1000;

  const hasSparklines = metrics_7d.length > 1 || sleep_7d.length > 1;

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
          {isDataStale && (
            <span
              className="flex items-center gap-1 text-[11px] text-[var(--accent-amber)]"
              data-testid="vitals-widget-stale"
              title="Data may be outdated"
            >
              <AlertTriangle size={12} />
            </span>
          )}
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

      {/* Mini sparkline charts */}
      {hasSparklines && (
        <div className="border-t border-border-subtle grid grid-cols-2 gap-0">
          <div className="border-r border-r-border-subtle">
            <StepsSparkline data={metrics_7d} />
          </div>
          <div>
            <SleepSparkline data={sleep_7d} />
          </div>
        </div>
      )}
    </div>
  );
}
