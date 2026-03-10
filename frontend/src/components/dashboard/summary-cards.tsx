"use client";

import {
  CheckSquare,
  AlertCircle,
  Briefcase,
  CalendarDays,
} from "lucide-react";
import type { DashboardSummary } from "@/types/dashboard";

interface SummaryCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  subtitle?: string;
  color: string;         // CSS color value
  colorMuted: string;    // CSS color for muted bg
}

function SummaryCard({ icon, label, value, subtitle, color, colorMuted }: SummaryCardProps) {
  return (
    <div className="rounded-xl border border-border-subtle bg-card transition-colors duration-150 hover:bg-card-hover hover:border-border">
      <div className="p-[20px_22px]">
        <div className="flex items-start justify-between mb-[14px]">
          <span className="text-[13px] font-medium text-muted-foreground tracking-[0.01em]">
            {label}
          </span>
          {/* Icon badge */}
          <span
            className="flex h-[32px] w-[32px] items-center justify-center rounded-lg"
            style={{ color, background: colorMuted }}
          >
            {icon}
          </span>
        </div>

        <p
          className="text-[32px] font-semibold leading-none mb-[6px] text-foreground"
          style={{ fontFeatureSettings: "'tnum'" }}
        >
          {value}
        </p>
        {subtitle && (
          <p className="text-[12px] text-tertiary">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

function SummaryCardSkeleton() {
  return (
    <div className="rounded-xl border border-border-subtle bg-card">
      <div className="p-[20px_22px]">
        <div className="flex items-start justify-between mb-[14px]">
          <div className="h-4 w-24 rounded bg-muted animate-pulse" />
          <div className="h-[32px] w-[32px] rounded-lg bg-muted animate-pulse" />
        </div>
        <div className="h-8 w-16 rounded bg-muted animate-pulse mb-[6px]" />
        <div className="h-3 w-32 rounded bg-muted animate-pulse" />
      </div>
    </div>
  );
}

interface SummaryCardsProps {
  data: DashboardSummary | undefined;
  isLoading: boolean;
}

// CSS variable references — theme-aware
const BLUE = "var(--primary)";
const BLUE_MUTED = "var(--accent-muted)";
const GREEN = "var(--accent-teal)";
const GREEN_MUTED = "var(--accent-teal-muted)";
const AMBER = "var(--accent-amber)";
const AMBER_MUTED = "var(--accent-amber-muted)";
const RED = "var(--destructive)";
const RED_MUTED = "var(--destructive-muted)";

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

  const overdueColor = tasks?.overdue ? RED : GREEN;
  const overdueMuted = tasks?.overdue ? RED_MUTED : GREEN_MUTED;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <SummaryCard
        icon={<CheckSquare size={16} />}
        label="Active Tasks"
        value={tasks?.active ?? 0}
        subtitle={tasks ? `${tasks.completion_rate}% completion rate` : undefined}
        color={BLUE}
        colorMuted={BLUE_MUTED}
      />
      <SummaryCard
        icon={<AlertCircle size={16} />}
        label="Overdue Tasks"
        value={tasks?.overdue ?? 0}
        subtitle={tasks?.overdue ? "Need attention" : "All on track"}
        color={overdueColor}
        colorMuted={overdueMuted}
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
        color={AMBER}
        colorMuted={AMBER_MUTED}
      />
      <SummaryCard
        icon={<CalendarDays size={16} />}
        label="Upcoming Events"
        value={calendar?.upcoming_count ?? 0}
        subtitle="Next 7 days"
        color={RED}
        colorMuted={RED_MUTED}
      />
    </div>
  );
}
