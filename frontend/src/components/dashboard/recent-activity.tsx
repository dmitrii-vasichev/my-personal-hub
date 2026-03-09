"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CheckSquare,
  Briefcase,
  CalendarDays,
  Zap,
  Plus,
} from "lucide-react";
import { useTasks } from "@/hooks/use-tasks";
import { useApplications } from "@/hooks/use-applications";
import { useDashboardSummary } from "@/hooks/use-dashboard";

interface ActivityItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  time: string;
  href: string;
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatEventTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMins = Math.floor(diffMs / 60_000);

  if (diffMins < 60) return `in ${diffMins}m`;
  const hours = Math.floor(diffMins / 60);
  if (hours < 24) return `in ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

export function RecentActivity() {
  const router = useRouter();
  const { data: tasks } = useTasks();
  const { data: applications } = useApplications();
  const { data: summary } = useDashboardSummary();

  const items = useMemo<ActivityItem[]>(() => {
    const result: ActivityItem[] = [];

    if (tasks) {
      const sorted = [...tasks]
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .slice(0, 4);
      for (const task of sorted) {
        result.push({
          id: `task-${task.id}`,
          icon: <CheckSquare size={14} className="text-[#4f8fea]" />,
          label: task.title,
          time: formatRelativeTime(task.updated_at),
          href: `/tasks/${task.id}`,
        });
      }
    }

    if (applications && Array.isArray(applications)) {
      const sorted = [...applications]
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .slice(0, 3);
      for (const app of sorted) {
        const jobTitle = app.job?.title ?? "Application";
        result.push({
          id: `app-${app.id}`,
          icon: <Briefcase size={14} className="text-[#f0b849]" />,
          label: `${jobTitle} — ${app.status.replace(/_/g, " ")}`,
          time: formatRelativeTime(app.updated_at),
          href: `/jobs/applications/${app.id}`,
        });
      }
    }

    if (summary?.calendar.upcoming_events) {
      for (const event of summary.calendar.upcoming_events.slice(0, 3)) {
        result.push({
          id: `event-${event.id}`,
          icon: <CalendarDays size={14} className="text-[#3dd68c]" />,
          label: event.title,
          time: formatEventTime(event.start_time),
          href: `/calendar/${event.id}`,
        });
      }
    }

    return result.slice(0, 10);
  }, [tasks, applications, summary]);

  if (items.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-xl border border-border-subtle bg-card px-8 py-12 text-center"
        style={{ animation: "fadeSlideUp 0.5s ease 0.5s both" }}
      >
        {/* Zap icon badge */}
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent-muted text-primary">
          <Zap size={22} />
        </div>
        <p className="mb-1.5 text-[15px] font-medium text-foreground">No recent activity</p>
        <p className="mb-5 max-w-[300px] text-[13px] text-tertiary">
          Start by creating a task or adding a job application to see your activity here
        </p>
        <div className="flex gap-2.5">
          <Link
            href="/tasks"
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground transition-all duration-150 hover:opacity-85"
          >
            <Plus size={14} />
            New Task
          </Link>
          <Link
            href="/jobs"
            className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-[13px] font-medium text-muted-foreground transition-all duration-150 hover:border-tertiary hover:text-foreground"
          >
            <Briefcase size={14} />
            Add Application
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl border border-border-subtle bg-card"
      style={{ animation: "fadeSlideUp 0.5s ease 0.5s both" }}
    >
      <div className="border-b border-border-subtle px-4 py-3">
        <h2 className="text-sm font-medium text-foreground">Recent Activity</h2>
      </div>
      <ul>
        {items.map((item, idx) => (
          <li
            key={item.id}
            className={`flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-hover ${
              idx < items.length - 1 ? "border-b border-border-subtle" : ""
            }`}
            onClick={() => router.push(item.href)}
          >
            <span className="shrink-0">{item.icon}</span>
            <span className="min-w-0 flex-1 truncate text-sm text-foreground">{item.label}</span>
            <span className="shrink-0 text-xs text-tertiary">{item.time}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
