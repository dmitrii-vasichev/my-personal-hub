"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format } from "date-fns";
import type { VitalsDailyMetric } from "@/types/vitals";
import type { Period } from "../period-selector";

interface HrvChartProps {
  data: VitalsDailyMetric[] | undefined;
  period: Period;
  isLoading: boolean;
}

export function HrvChart({ data, period, isLoading }: HrvChartProps) {
  if (isLoading) {
    return <div className="h-[250px] animate-pulse rounded-xl bg-muted" />;
  }

  const chartData = (data ?? [])
    .filter((m) => m.hrv_last_night_avg != null || m.hrv_weekly_avg != null)
    .map((m) => ({
      date: m.date,
      label: period === "7d"
        ? format(new Date(m.date), "MMM d")
        : format(new Date(m.date), "MM/dd"),
      last_night: m.hrv_last_night_avg,
      weekly_avg: m.hrv_weekly_avg,
    }));

  if (chartData.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No data</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "var(--text-tertiary)" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "var(--text-tertiary)" }}
          tickFormatter={(v) => `${v}`}
          tickLine={false}
          axisLine={false}
          domain={["dataMin - 5", "dataMax + 5"]}
        />
        <Tooltip
          formatter={(v, name) => [
            `${v} ms`,
            name === "weekly_avg" ? "7-day Avg" : "Nightly HRV",
          ]}
          contentStyle={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
          }}
        />
        <Line
          type="monotone"
          dataKey="last_night"
          stroke="var(--destructive)"
          strokeWidth={2}
          dot={period === "7d"}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="weekly_avg"
          stroke="var(--primary)"
          strokeDasharray="4 4"
          strokeWidth={1.5}
          dot={false}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
