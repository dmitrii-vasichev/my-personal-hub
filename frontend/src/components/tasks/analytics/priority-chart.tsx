"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from "recharts";
import type { PriorityDistributionItem } from "@/types/task-analytics";

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "#f87171",
  high: "#fbbf24",
  medium: "#4f8ef7",
  low: "#34d399",
};

interface Props {
  data: PriorityDistributionItem[] | undefined;
  isLoading: boolean;
}

export function PriorityDistributionChart({ data, isLoading }: Props) {
  if (isLoading) {
    return <div className="h-64 animate-pulse rounded-xl bg-muted" />;
  }

  const filtered = (data ?? []).filter((d) => d.count > 0);

  return (
    <div className="rounded-xl border border-border p-4">
      <h3 className="mb-4 text-sm font-medium">Tasks by Priority</h3>
      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No tasks yet</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={filtered} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#252a3a" vertical={false} />
            <XAxis dataKey="priority" tick={{ fontSize: 11, fill: "#6b7280" }} />
            <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {filtered.map((entry) => (
                <Cell
                  key={entry.priority}
                  fill={PRIORITY_COLORS[entry.priority] ?? "#4f8ef7"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
