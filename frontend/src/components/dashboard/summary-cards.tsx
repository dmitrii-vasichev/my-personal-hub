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
  accent?: "default" | "warning" | "danger";
}

function SummaryCard({ icon, label, value, subtitle, accent = "default" }: SummaryCardProps) {
  const iconColor =
    accent === "danger"
      ? "text-[#E5484D]"
      : accent === "warning"
      ? "text-[#F5A623]"
      : "text-[#5B6AD0]";

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <span className={iconColor}>{icon}</span>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {label}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold tracking-tight">{value}</p>
        {subtitle && (
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
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
      />
      <SummaryCard
        icon={<AlertCircle size={16} />}
        label="Overdue Tasks"
        value={tasks?.overdue ?? 0}
        subtitle={tasks?.overdue ? "Need attention" : "All on track"}
        accent={tasks?.overdue ? "danger" : "default"}
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
        accent={jobHunt?.upcoming_interviews ? "warning" : "default"}
      />
      <SummaryCard
        icon={<CalendarDays size={16} />}
        label="Upcoming Events"
        value={calendar?.upcoming_count ?? 0}
        subtitle="Next 7 days"
      />
    </div>
  );
}
