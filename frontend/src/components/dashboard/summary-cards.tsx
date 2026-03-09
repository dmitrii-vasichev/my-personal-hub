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
  animationDelay: string;
}

function SummaryCard({ icon, label, value, subtitle, color, colorMuted, animationDelay }: SummaryCardProps) {
  return (
    <div
      className="relative overflow-hidden rounded-xl border border-border-subtle bg-card transition-all duration-200 ease-in-out hover:bg-card-hover hover:border-border hover:-translate-y-px cursor-pointer"
      style={{ animation: `fadeSlideUp 0.5s ease ${animationDelay} both` }}
    >
      {/* Top accent line */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px] rounded-t-xl"
        style={{ background: color, opacity: 0.7 }}
      />

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

function SummaryCardSkeleton({ animationDelay }: { animationDelay: string }) {
  return (
    <div
      className="relative overflow-hidden rounded-xl border border-border-subtle bg-card"
      style={{ animation: `fadeSlideUp 0.5s ease ${animationDelay} both` }}
    >
      <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-xl bg-border" />
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

// Design-ref colors
const BLUE = "#4f8fea";
const BLUE_MUTED = "rgba(79,143,234,0.12)";
const GREEN = "#3dd68c";
const GREEN_MUTED = "rgba(61,214,140,0.12)";
const AMBER = "#f0b849";
const AMBER_MUTED = "rgba(240,184,73,0.12)";
const RED = "#ef6464";
const RED_MUTED = "rgba(239,100,100,0.12)";

export function SummaryCards({ data, isLoading }: SummaryCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(["0.15s", "0.2s", "0.25s", "0.3s"] as const).map((delay, i) => (
          <SummaryCardSkeleton key={i} animationDelay={delay} />
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
        animationDelay="0.15s"
      />
      <SummaryCard
        icon={<AlertCircle size={16} />}
        label="Overdue Tasks"
        value={tasks?.overdue ?? 0}
        subtitle={tasks?.overdue ? "Need attention" : "All on track"}
        color={overdueColor}
        colorMuted={overdueMuted}
        animationDelay="0.2s"
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
        animationDelay="0.25s"
      />
      <SummaryCard
        icon={<CalendarDays size={16} />}
        label="Upcoming Events"
        value={calendar?.upcoming_count ?? 0}
        subtitle="Next 7 days"
        color={RED}
        colorMuted={RED_MUTED}
        animationDelay="0.3s"
      />
    </div>
  );
}
