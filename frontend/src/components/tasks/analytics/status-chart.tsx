"use client";

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { StatusDistributionItem } from "@/types/task-analytics";

const STATUS_COLORS: Record<string, string> = {
  new: "#8B8B93",
  in_progress: "#5B6AD0",
  review: "#F5A623",
  done: "#30A46C",
  cancelled: "#E5484D",
};

interface Props {
  data: StatusDistributionItem[] | undefined;
  isLoading: boolean;
}

export function StatusDistributionChart({ data, isLoading }: Props) {
  if (isLoading) {
    return <div className="h-64 animate-pulse rounded-xl bg-muted" />;
  }

  const filtered = (data ?? []).filter((d) => d.count > 0);

  return (
    <div className="rounded-xl border border-border p-4">
      <h3 className="mb-4 text-sm font-medium">Status Distribution</h3>
      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No tasks yet</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={filtered}
              dataKey="count"
              nameKey="status"
              cx="50%"
              cy="50%"
              outerRadius={80}
              label={({ name, percent }) =>
                `${String(name).replace("_", " ")} ${Math.round((percent ?? 0) * 100)}%`
              }
              labelLine={false}
            >
              {filtered.map((entry) => (
                <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? "#5B6AD0"} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => [value, String(name).replace("_", " ")]}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
