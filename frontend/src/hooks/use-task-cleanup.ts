"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  PreserveTaskLinkedRemindersResponse,
  TaskLinkedReminderReviewItem,
} from "@/types/task-cleanup";

const TASK_CLEANUP_KEY = "task-cleanup";

export function useTaskCleanupReview() {
  return useQuery<TaskLinkedReminderReviewItem[]>({
    queryKey: [TASK_CLEANUP_KEY, "review"],
    queryFn: () =>
      api.get<TaskLinkedReminderReviewItem[]>("/api/actions/task-cleanup/review"),
  });
}

export function usePreserveTaskLinkedReminders() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reminderIds: number[]) =>
      api.post<PreserveTaskLinkedRemindersResponse>(
        "/api/actions/task-cleanup/preserve",
        { reminder_ids: reminderIds },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [TASK_CLEANUP_KEY] });
      qc.invalidateQueries({ queryKey: ["actions"] });
    },
  });
}
