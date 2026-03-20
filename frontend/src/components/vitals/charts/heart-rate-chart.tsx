"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";
import type { VitalsDailyMetric } from "@/types/vitals";
import type { Period } from "../period-selector";

interface HeartRateChartProps {
  data: VitalsDailyMetric[] | undefined;
  period: Period;
  isLoading: boolean;
}

export function HeartRateChart({ data, period, isLoading }: HeartRateChartProps) {
  if (isLoading) {
    return <div className="h-[250px] animate-pulse rounded-xl bg-muted" />;
  }

  const chartData = (data ?? [])
    .filter((m) => m.resting_hr != null)
    .map((m) => ({
      date: m.date,
      label: period === "7d"
        ? format(new Date(m.date), "MMM d")
        : format(new Date(m.date), "MM/dd"),
      resting_hr: m.resting_hr,
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
          formatter={(v) => [`${v} bpm`, "Resting HR"]}
          contentStyle={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
          }}
        />
        <Line
          type="monotone"
          dataKey="resting_hr"
          stroke="var(--destructive)"
          strokeWidth={2}
          dot={period === "7d"}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
