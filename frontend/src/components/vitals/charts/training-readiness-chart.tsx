"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Period } from "../period-selector";
import { getDateAxisProps } from "./date-axis";

export interface TrainingReadinessPoint {
  date: string;
  value: number | null;
  level?: string | null;
  recovery?: number | null;
}

interface TrainingReadinessChartProps {
  data: TrainingReadinessPoint[] | undefined;
  period: Period;
  isLoading: boolean;
}

interface TooltipPayloadEntry {
  payload?: TrainingReadinessPoint;
  value?: number | string | null;
}

function ReadinessTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
}) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }
  const entry = payload[0]?.payload;
  if (!entry) return null;
  const isPrime = entry.level === "PRIME";
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        fontSize: 12,
        padding: "8px 10px",
      }}
    >
      <div style={{ fontWeight: 600 }}>{entry.value ?? "—"}</div>
      {entry.level ? (
        <div
          style={{
            color: isPrime ? "var(--primary)" : "var(--text-tertiary)",
            fontWeight: isPrime ? 600 : undefined,
          }}
        >
          {isPrime ? `✨ ${entry.level}` : entry.level}
        </div>
      ) : null}
      {entry.recovery != null ? (
        <div style={{ color: "var(--text-tertiary)" }}>
          Recovery: {entry.recovery}h
        </div>
      ) : null}
    </div>
  );
}

export function TrainingReadinessChart({
  data,
  period,
  isLoading,
}: TrainingReadinessChartProps) {
  if (isLoading) {
    return <div className="h-[250px] animate-pulse rounded-xl bg-muted" />;
  }

  const chartData = (data ?? []).filter((p) => p.value != null);

  if (chartData.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No data</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={250}>
      <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="readinessGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#22c55e" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis {...getDateAxisProps(period, chartData.map((point) => point.date))} />
        <YAxis
          tick={{ fontSize: 11, fill: "var(--text-tertiary)" }}
          tickLine={false}
          axisLine={false}
          domain={[0, 100]}
        />
        <Tooltip content={<ReadinessTooltip />} />
        <Area
          type="monotone"
          dataKey="value"
          stroke="#22c55e"
          strokeWidth={2}
          fill="url(#readinessGradient)"
          dot={period === "7d"}
          connectNulls
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
