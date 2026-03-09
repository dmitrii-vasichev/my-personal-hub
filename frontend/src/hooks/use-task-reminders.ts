"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Task } from "@/types/task";

const REMINDERS_KEY = "task-reminders-due";

export function useDueReminders(enabled = true) {
  return useQuery<Task[]>({
    queryKey: [REMINDERS_KEY],
    queryFn: () => api.get<Task[]>("/api/tasks/reminders/due"),
    enabled,
    refetchInterval: 60_000, // poll every minute
    staleTime: 30_000,
  });
}

export function useDismissReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId: number) =>
      api.post<Task>(`/api/tasks/${taskId}/reminders/dismiss`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [REMINDERS_KEY] });
    },
  });
}
