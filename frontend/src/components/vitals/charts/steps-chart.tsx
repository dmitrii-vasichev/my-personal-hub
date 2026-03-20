"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";
import type { VitalsDailyMetric } from "@/types/vitals";
import type { Period } from "../period-selector";

interface StepsChartProps {
  data: VitalsDailyMetric[] | undefined;
  period: Period;
  isLoading: boolean;
}

export function StepsChart({ data, period, isLoading }: StepsChartProps) {
  if (isLoading) {
    return <div className="h-[250px] animate-pulse rounded-xl bg-muted" />;
  }

  const chartData = (data ?? []).map((m) => ({
    date: m.date,
    label: period === "7d"
      ? format(new Date(m.date), "MMM d")
      : format(new Date(m.date), "MM/dd"),
    steps: m.steps ?? 0,
  }));

  if (chartData.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No data</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "var(--text-tertiary)" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "var(--text-tertiary)" }}
          tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          formatter={(v) => [`${Number(v).toLocaleString()}`, "Steps"]}
          contentStyle={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
          }}
        />
        <Bar dataKey="steps" fill="var(--accent-teal)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
