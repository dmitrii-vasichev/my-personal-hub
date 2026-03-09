"use client";

import {
  CheckSquare,
  AlertCircle,
  Briefcase,
  CalendarDays,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardSummary } from "@/types/dashboard";

interface SummaryCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  subtitle?: string;
  accent?: "default" | "teal" | "violet" | "warning" | "danger";
}

function SummaryCard({ icon, label, value, subtitle, accent = "default" }: SummaryCardProps) {
  const accentConfig = {
    default: { text: "text-primary", border: "border-t-primary", iconBg: "bg-primary/10" },
    teal: { text: "text-accent-teal", border: "border-t-accent-teal", iconBg: "bg-accent-teal/10" },
    violet: { text: "text-accent-violet", border: "border-t-accent-violet", iconBg: "bg-accent-violet/10" },
    warning: { text: "text-accent-amber", border: "border-t-accent-amber", iconBg: "bg-accent-amber/10" },
    danger: { text: "text-destructive", border: "border-t-destructive", iconBg: "bg-destructive/10" },
  };
  const config = accentConfig[accent];

  return (
    <Card className={`relative overflow-hidden border-t-2 ${config.border}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-normal text-muted-foreground">
            {label}
          </CardTitle>
          <span className={`flex h-[30px] w-[30px] items-center justify-center rounded-lg ${config.iconBg} ${config.text}`}>
            {icon}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <p className={`text-[28px] font-bold tracking-tight leading-none mb-2 ${config.text}`}>{value}</p>
        {subtitle && (
          <p className="text-[11px] text-muted-foreground">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}

function SummaryCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="h-4 w-24 rounded bg-muted animate-pulse" />
      </CardHeader>
      <CardContent>
        <div className="h-8 w-16 rounded bg-muted animate-pulse" />
        <div className="mt-2 h-3 w-32 rounded bg-muted animate-pulse" />
      </CardContent>
    </Card>
  );
}

interface SummaryCardsProps {
  data: DashboardSummary | undefined;
  isLoading: boolean;
}

export function SummaryCards({ data, isLoading }: SummaryCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SummaryCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  const tasks = data?.tasks;
  const jobHunt = data?.job_hunt;
  const calendar = data?.calendar;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <SummaryCard
        icon={<CheckSquare size={16} />}
        label="Active Tasks"
        value={tasks?.active ?? 0}
        subtitle={
          tasks
            ? `${tasks.completion_rate}% completion rate`
            : undefined
        }
        accent="default"
      />
      <SummaryCard
        icon={<AlertCircle size={16} />}
        label="Overdue Tasks"
        value={tasks?.overdue ?? 0}
        subtitle={tasks?.overdue ? "Need attention" : "All on track"}
        accent={tasks?.overdue ? "danger" : "teal"}
      />
      <SummaryCard
        icon={<Briefcase size={16} />}
        label="Open Applications"
        value={jobHunt?.active_applications ?? 0}
        subtitle={
          jobHunt?.upcoming_interviews
            ? `${jobHunt.upcoming_interviews} interview${jobHunt.upcoming_interviews > 1 ? "s" : ""} upcoming`
            : "No interviews scheduled"
        }
        accent="violet"
      />
      <SummaryCard
        icon={<CalendarDays size={16} />}
        label="Upcoming Events"
        value={calendar?.upcoming_count ?? 0}
        subtitle="Next 7 days"
        accent="warning"
      />
    </div>
  );
}
