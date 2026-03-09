"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  useAnalyticsFunnel,
  useAnalyticsSkills,
  useAnalyticsSources,
  useAnalyticsSummary,
  useAnalyticsTimeline,
} from "@/hooks/use-analytics";

const STATUS_LABELS: Record<string, string> = {
  found: "Found",
  saved: "Saved",
  resume_generated: "Resume",
  applied: "Applied",
  screening: "Screening",
  technical_interview: "Technical",
  final_interview: "Final",
  offer: "Offer",
  accepted: "Accepted",
  rejected: "Rejected",
  ghosted: "Ghosted",
  withdrawn: "Withdrawn",
};

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

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-sm font-medium mb-4">{title}</p>
      {children}
    </div>
  );
}

export function JobAnalytics() {
  const { data: summary, isLoading: loadingSummary } = useAnalyticsSummary();
  const { data: funnel = [], isLoading: loadingFunnel } = useAnalyticsFunnel();
  const { data: timeline = [], isLoading: loadingTimeline } = useAnalyticsTimeline();
  const { data: skills = [], isLoading: loadingSkills } = useAnalyticsSkills();
  const { data: sources = [], isLoading: loadingSources } = useAnalyticsSources();

  const activeFunnel = funnel.filter((f) => f.count > 0);
  const sourcesData = sources.map((s) => ({
    ...s,
    source: s.source ?? "Unknown",
  }));

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {loadingSummary ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-border bg-surface p-4 h-20 animate-pulse" />
          ))
        ) : summary ? (
          <>
            <KpiCard label="Jobs tracked" value={summary.total_jobs} />
            <KpiCard label="Applications" value={summary.total_applications} />
            <KpiCard label="Interview rate" value={`${summary.interview_rate}%`} />
            <KpiCard label="Offer rate" value={`${summary.offer_rate}%`} />
            <KpiCard
              label="Avg ATS score"
              value={summary.avg_ats_score !== null ? summary.avg_ats_score : "—"}
            />
          </>
        ) : null}
      </div>

      {/* Funnel + Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Application Funnel">
          {loadingFunnel ? (
            <div className="h-48 animate-pulse bg-surface-hover rounded" />
          ) : activeFunnel.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">No data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={activeFunnel} layout="vertical" margin={{ left: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                <YAxis
                  type="category"
                  dataKey="status"
                  tick={{ fontSize: 11 }}
                  stroke="var(--muted-foreground)"
                  tickFormatter={(v) => STATUS_LABELS[v] ?? v}
                  width={70}
                />
                <Tooltip
                  contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                  labelFormatter={(v) => STATUS_LABELS[v as string] ?? v}
                />
                <Bar dataKey="count" fill="var(--primary)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Applications Over Time (12 weeks)">
          {loadingTimeline ? (
            <div className="h-48 animate-pulse bg-surface-hover rounded" />
          ) : timeline.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">No data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={timeline} margin={{ left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="week"
                  tick={{ fontSize: 10 }}
                  stroke="var(--muted-foreground)"
                  tickFormatter={(v: string) => v.split("-W")[1] ? `W${v.split("-W")[1]}` : v}
                />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  dot={{ fill: "var(--primary)", r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Skills + Sources */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Top Skills in Demand">
          {loadingSkills ? (
            <div className="h-48 animate-pulse bg-surface-hover rounded" />
          ) : skills.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">No tags on jobs yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={skills.slice(0, 15)} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                <YAxis
                  type="category"
                  dataKey="skill"
                  tick={{ fontSize: 10 }}
                  stroke="var(--muted-foreground)"
                  width={90}
                />
                <Tooltip
                  contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="count" fill="var(--success)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Jobs by Source">
          {loadingSources ? (
            <div className="h-48 animate-pulse bg-surface-hover rounded" />
          ) : sourcesData.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">No data yet</p>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="60%" height={220}>
                <PieChart>
                  <Pie
                    data={sourcesData}
                    dataKey="count"
                    nameKey="source"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    innerRadius={40}
                    paddingAngle={2}
                  >
                    {sourcesData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1.5 min-w-0">
                {sourcesData.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span
                      className="inline-block h-2 w-2 rounded-full flex-shrink-0"
                      style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                    />
                    <span className="truncate text-muted-foreground">{s.source}</span>
                    <span className="ml-auto font-medium">{s.count}</span>
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
