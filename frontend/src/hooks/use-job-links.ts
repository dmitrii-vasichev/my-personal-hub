"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { LinkedEventBrief } from "@/types/job";
import { JOBS_KEY } from "./use-jobs";

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
