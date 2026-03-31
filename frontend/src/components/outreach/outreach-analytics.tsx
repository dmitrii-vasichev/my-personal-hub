"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useOutreachAnalytics } from "@/hooks/use-leads";
import { LEAD_STATUS_LABELS } from "@/types/lead";

const PIE_COLORS = [
  "var(--primary)",
  "var(--success)",
  "var(--warning)",
  "var(--danger)",
  "#8b5cf6",
  "#06b6d4",
  "#f59e0b",
  "#10b981",
];

const TOOLTIP_STYLE = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
};

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="text-xs text-[var(--text-tertiary)] mb-1">{label}</p>
      <p className="text-2xl font-semibold text-[var(--text-primary)]">{value}</p>
      {sub && <p className="text-xs text-[var(--text-tertiary)] mt-1">{sub}</p>}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="text-sm font-medium text-[var(--text-primary)] mb-4">{title}</p>
      {children}
    </div>
  );
}

export function OutreachAnalytics() {
  const { data, isLoading } = useOutreachAnalytics();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 h-20 animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 h-64 animate-pulse" />
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 h-64 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const activeFunnel = data.by_status.filter((s) => s.count > 0);

  // KPI counts
  const statusMap = Object.fromEntries(data.by_status.map((s) => [s.status, s.count]));
  const contactedPlus = data.total - (statusMap["new"] ?? 0);

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Total Leads" value={data.total} />
        <KpiCard
          label="Contacted"
          value={contactedPlus}
          sub={data.total > 0 ? `${Math.round((contactedPlus / data.total) * 100)}% of total` : undefined}
        />
        <KpiCard
          label="Contacted → Responded"
          value={data.conversion_contacted_to_responded != null ? `${data.conversion_contacted_to_responded}%` : "—"}
        />
        <KpiCard
          label="Responded → Negotiating"
          value={data.conversion_responded_to_negotiating != null ? `${data.conversion_responded_to_negotiating}%` : "—"}
        />
      </div>

      {/* Funnel + Industry breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Outreach Funnel">
          {activeFunnel.length === 0 ? (
            <p className="text-xs text-[var(--text-tertiary)] text-center py-8">No data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={activeFunnel} layout="vertical" margin={{ left: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="var(--text-tertiary)" />
                <YAxis
                  type="category"
                  dataKey="status"
                  tick={{ fontSize: 11 }}
                  stroke="var(--text-tertiary)"
                  tickFormatter={(v) => LEAD_STATUS_LABELS[v as keyof typeof LEAD_STATUS_LABELS] ?? v}
                  width={80}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelFormatter={(v) => LEAD_STATUS_LABELS[v as keyof typeof LEAD_STATUS_LABELS] ?? v}
                />
                <Bar dataKey="count" fill="var(--primary)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Leads by Industry">
          {data.by_industry.length === 0 ? (
            <p className="text-xs text-[var(--text-tertiary)] text-center py-8">No data yet</p>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="60%" height={220}>
                <PieChart>
                  <Pie
                    data={data.by_industry}
                    dataKey="count"
                    nameKey="industry_name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    innerRadius={40}
                    paddingAngle={2}
                  >
                    {data.by_industry.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1.5 min-w-0">
                {data.by_industry.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span
                      className="inline-block h-2 w-2 rounded-full flex-shrink-0"
                      style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                    />
                    <span className="truncate text-[var(--text-secondary)]">{item.industry_name}</span>
                    <span className="ml-auto font-medium text-[var(--text-primary)]">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
