"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { VitalsDailyMetric } from "@/types/vitals";
import type { Period } from "../period-selector";
import { getDateAxisProps } from "./date-axis";

interface BodyBatteryChartProps {
  data: VitalsDailyMetric[] | undefined;
  period: Period;
  isLoading: boolean;
}

export function BodyBatteryChart({ data, period, isLoading }: BodyBatteryChartProps) {
  if (isLoading) {
    return <div className="h-[250px] animate-pulse rounded-xl bg-muted" />;
  }

  const chartData = (data ?? [])
    .filter((m) => m.body_battery_high != null || m.body_battery_low != null)
    .map((m) => ({
      date: m.date,
      high: m.body_battery_high ?? 0,
      low: m.body_battery_low ?? 0,
    }));

  if (chartData.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No data</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={250}>
      <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis {...getDateAxisProps(period, chartData.map((point) => point.date))} />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 11, fill: "var(--text-tertiary)" }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          formatter={(v, name) => [
            `${v}`,
            name === "high" ? "High" : "Low",
          ]}
          contentStyle={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
          }}
        />
        <Area
          type="monotone"
          dataKey="high"
          stroke="#10b981"
          fill="#10b981"
          fillOpacity={0.15}
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="low"
          stroke="#10b981"
          fill="#10b981"
          fillOpacity={0.05}
          strokeWidth={1}
          strokeDasharray="4 4"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
