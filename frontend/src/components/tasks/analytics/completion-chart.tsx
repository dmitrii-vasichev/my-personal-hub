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
import type { CompletionRatePoint } from "@/types/task-analytics";

interface Props {
  data: CompletionRatePoint[] | undefined;
  isLoading: boolean;
}

export function CompletionRateChart({ data, isLoading }: Props) {
  if (isLoading) {
    return <div className="h-64 animate-pulse rounded-xl bg-muted" />;
  }

  // Show only last 8 weeks to keep chart readable
  const chartData = (data ?? []).slice(-8).map((p) => ({
    ...p,
    weekLabel: p.week.replace(/\d{4}-/, ""),
  }));

  return (
    <div className="rounded-xl border border-border p-4">
      <h3 className="mb-4 text-sm font-medium">Weekly Completion Rate</h3>
      {chartData.every((p) => p.created === 0) ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No data yet</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#232329" />
            <XAxis dataKey="weekLabel" tick={{ fontSize: 11, fill: "#8B8B93" }} />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 11, fill: "#8B8B93" }}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip formatter={(v) => [`${v}%`, "Completion rate"]} />
            <Line
              type="monotone"
              dataKey="rate"
              stroke="#5B6AD0"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
