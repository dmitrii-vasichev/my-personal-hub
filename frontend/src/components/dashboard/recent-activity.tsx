"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  CheckSquare,
  Briefcase,
  CalendarDays,
  Clock,
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
  const { data: tasks } = useTasks({ limit: 5 } as any);
  const { data: applications } = useApplications({ limit: 5 } as any);
  const { data: summary } = useDashboardSummary();

  const items = useMemo<ActivityItem[]>(() => {
    const result: ActivityItem[] = [];

    // Recent tasks (by updated_at)
    if (tasks) {
      const sorted = [...tasks]
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .slice(0, 4);
      for (const task of sorted) {
        result.push({
          id: `task-${task.id}`,
          icon: <CheckSquare size={14} className="text-[#5B6AD0]" />,
          label: task.title,
          time: formatRelativeTime(task.updated_at),
          href: `/tasks/${task.id}`,
        });
      }
    }

    // Recent applications (by updated_at)
    if (applications && Array.isArray(applications)) {
      const sorted = [...applications]
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .slice(0, 3);
      for (const app of sorted) {
        const jobTitle = app.job?.title ?? "Application";
        result.push({
          id: `app-${app.id}`,
          icon: <Briefcase size={14} className="text-[#F5A623]" />,
          label: `${jobTitle} — ${app.status.replace(/_/g, " ")}`,
          time: formatRelativeTime(app.updated_at),
          href: `/jobs/applications/${app.id}`,
        });
      }
    }

    // Upcoming calendar events from dashboard summary
    if (summary?.calendar.upcoming_events) {
      for (const event of summary.calendar.upcoming_events.slice(0, 3)) {
        result.push({
          id: `event-${event.id}`,
          icon: <CalendarDays size={14} className="text-[#30A46C]" />,
          label: event.title,
          time: formatEventTime(event.start_time),
          href: `/calendar/${event.id}`,
        });
      }
    }

    // Sort all by proximity/time
    return result.slice(0, 10);
  }, [tasks, applications, summary]);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-border py-12 text-center">
        <Clock size={24} className="text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No recent activity yet</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-medium">Recent Activity</h2>
      </div>
      <ul>
        {items.map((item, idx) => (
          <li
            key={item.id}
            className={`flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors ${
              idx < items.length - 1 ? "border-b border-border" : ""
            }`}
            onClick={() => router.push(item.href)}
          >
            <span className="shrink-0">{item.icon}</span>
            <span className="min-w-0 flex-1 truncate text-sm">{item.label}</span>
            <span className="shrink-0 text-xs text-muted-foreground">{item.time}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
