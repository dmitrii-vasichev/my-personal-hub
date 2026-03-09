"use client";

import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import type { OverdueData } from "@/types/task-analytics";

const PRIORITY_BADGE: Record<string, string> = {
  urgent: "bg-[#E5484D]/20 text-[#E5484D]",
  high: "bg-[#F5A623]/20 text-[#F5A623]",
  medium: "bg-[#5B6AD0]/20 text-[#5B6AD0]",
  low: "bg-[#30A46C]/20 text-[#30A46C]",
};

function formatDeadline(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

interface Props {
  data: OverdueData | undefined;
  isLoading: boolean;
}

export function OverdueTasksList({ data, isLoading }: Props) {
  const router = useRouter();

  if (isLoading) {
    return <div className="h-64 animate-pulse rounded-xl bg-muted" />;
  }

  const tasks = data?.tasks ?? [];

  return (
    <div className="rounded-xl border border-border">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <AlertCircle size={14} className="text-[#E5484D]" />
        <h3 className="text-sm font-medium">
          Overdue Tasks
          {data && data.count > 0 && (
            <span className="ml-2 rounded-full bg-[#E5484D]/20 px-2 py-0.5 text-xs text-[#E5484D]">
              {data.count}
            </span>
          )}
        </h3>
      </div>
      {tasks.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No overdue tasks — great job!
        </p>
      ) : (
        <ul>
          {tasks.map((task, idx) => (
            <li
              key={task.id}
              className={`flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors ${
                idx < tasks.length - 1 ? "border-b border-border" : ""
              }`}
              onClick={() => router.push(`/tasks/${task.id}`)}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{task.title}</p>
                <p className="text-xs text-muted-foreground">
                  Due {formatDeadline(task.deadline)}
                </p>
              </div>
              <span
                className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${
                  PRIORITY_BADGE[task.priority] ?? "bg-muted text-muted-foreground"
                }`}
              >
                {task.priority}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
