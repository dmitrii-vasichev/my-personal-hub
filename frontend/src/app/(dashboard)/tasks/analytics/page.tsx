"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  useTaskStatusDistribution,
  useTaskPriorityDistribution,
  useTaskCompletionRate,
  useTaskOverdue,
} from "@/hooks/use-task-analytics";
import { StatusDistributionChart } from "@/components/tasks/analytics/status-chart";
import { CompletionRateChart } from "@/components/tasks/analytics/completion-chart";
import { PriorityDistributionChart } from "@/components/tasks/analytics/priority-chart";
import { OverdueTasksList } from "@/components/tasks/analytics/overdue-list";

export default function TaskAnalyticsPage() {
  const { data: statusData, isLoading: statusLoading } = useTaskStatusDistribution();
  const { data: priorityData, isLoading: priorityLoading } = useTaskPriorityDistribution();
  const { data: completionData, isLoading: completionLoading } = useTaskCompletionRate();
  const { data: overdueData, isLoading: overdueLoading } = useTaskOverdue();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/tasks"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Task Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Insights into your task management
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <StatusDistributionChart data={statusData} isLoading={statusLoading} />
        <PriorityDistributionChart data={priorityData} isLoading={priorityLoading} />
      </div>

      <CompletionRateChart data={completionData} isLoading={completionLoading} />

      <OverdueTasksList data={overdueData} isLoading={overdueLoading} />
    </div>
  );
}
