"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { LinkedTaskBrief, LinkedEventBrief } from "@/types/job";
import { JOBS_KEY } from "./use-jobs";

// ── Job → Linked Tasks ──────────────────────────────────────────────────────

export function useJobLinkedTasks(jobId: number) {
  return useQuery<LinkedTaskBrief[]>({
    queryKey: [JOBS_KEY, jobId, "linked-tasks"],
    queryFn: () => api.get<LinkedTaskBrief[]>(`/api/jobs/${jobId}/linked-tasks`),
    enabled: jobId > 0,
  });
}

export function useLinkJobToTask(jobId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId: number) =>
      api.post(`/api/jobs/${jobId}/link-task/${taskId}`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [JOBS_KEY, jobId, "linked-tasks"] });
    },
  });
}

export function useUnlinkJobFromTask(jobId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId: number) =>
      api.delete(`/api/jobs/${jobId}/link-task/${taskId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [JOBS_KEY, jobId, "linked-tasks"] });
    },
  });
}

// ── Job → Linked Events ─────────────────────────────────────────────────────

export function useJobLinkedEvents(jobId: number) {
  return useQuery<LinkedEventBrief[]>({
    queryKey: [JOBS_KEY, jobId, "linked-events"],
    queryFn: () =>
      api.get<LinkedEventBrief[]>(`/api/jobs/${jobId}/linked-events`),
    enabled: jobId > 0,
  });
}

export function useLinkJobToEvent(jobId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (eventId: number) =>
      api.post(`/api/jobs/${jobId}/link-event/${eventId}`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [JOBS_KEY, jobId, "linked-events"] });
    },
  });
}

export function useUnlinkJobFromEvent(jobId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (eventId: number) =>
      api.delete(`/api/jobs/${jobId}/link-event/${eventId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [JOBS_KEY, jobId, "linked-events"] });
    },
  });
}
