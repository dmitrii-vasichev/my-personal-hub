"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";
import type { VitalsSleep } from "@/types/vitals";
import type { Period } from "../period-selector";

interface SleepChartProps {
  data: VitalsSleep[] | undefined;
  period: Period;
  isLoading: boolean;
}

function secToHours(sec: number | null): number {
  if (sec == null) return 0;
  return Math.round((sec / 3600) * 100) / 100;
}

function formatHours(sec: number): string {
  const h = Math.floor(sec);
  const m = Math.round((sec - h) * 60);
  return `${h}h ${m}m`;
}

export function SleepChart({ data, period, isLoading }: SleepChartProps) {
  if (isLoading) {
    return <div className="h-[250px] animate-pulse rounded-xl bg-muted" />;
  }

  const chartData = (data ?? []).map((s) => ({
    date: s.date,
    label: period === "7d"
      ? format(new Date(s.date), "MMM d")
      : format(new Date(s.date), "MM/dd"),
    deep: secToHours(s.deep_seconds),
    light: secToHours(s.light_seconds),
    rem: secToHours(s.rem_seconds),
    awake: secToHours(s.awake_seconds),
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
          tickFormatter={(v) => `${v}h`}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          formatter={(v, name) => [formatHours(Number(v)), String(name).charAt(0).toUpperCase() + String(name).slice(1)]}
          contentStyle={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: 11 }}
          formatter={(value: string) => value.charAt(0).toUpperCase() + value.slice(1)}
        />
        <Bar dataKey="deep" stackId="sleep" fill="#6366f1" radius={[0, 0, 0, 0]} />
        <Bar dataKey="light" stackId="sleep" fill="#60a5fa" />
        <Bar dataKey="rem" stackId="sleep" fill="#a78bfa" />
        <Bar dataKey="awake" stackId="sleep" fill="#fbbf24" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
