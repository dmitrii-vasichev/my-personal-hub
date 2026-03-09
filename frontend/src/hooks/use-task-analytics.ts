"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  CompletionRatePoint,
  OverdueData,
  PriorityDistributionItem,
  StatusDistributionItem,
} from "@/types/task-analytics";

const KEY = "task-analytics";

export function useTaskStatusDistribution() {
  return useQuery<StatusDistributionItem[]>({
    queryKey: [KEY, "status"],
    queryFn: () => api.get<StatusDistributionItem[]>("/api/task-analytics/status-distribution"),
  });
}

export function useTaskPriorityDistribution() {
  return useQuery<PriorityDistributionItem[]>({
    queryKey: [KEY, "priority"],
    queryFn: () => api.get<PriorityDistributionItem[]>("/api/task-analytics/priority-distribution"),
  });
}

export function useTaskCompletionRate(weeks = 12) {
  return useQuery<CompletionRatePoint[]>({
    queryKey: [KEY, "completion", weeks],
    queryFn: () =>
      api.get<CompletionRatePoint[]>(`/api/task-analytics/completion-rate?weeks=${weeks}`),
  });
}

export function useTaskOverdue() {
  return useQuery<OverdueData>({
    queryKey: [KEY, "overdue"],
    queryFn: () => api.get<OverdueData>("/api/task-analytics/overdue"),
  });
}
