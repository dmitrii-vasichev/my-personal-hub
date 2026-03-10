"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { MatchResult } from "@/types/job";
import { JOBS_KEY } from "./use-jobs";

export function useRunJobMatch(jobId: number) {
  const qc = useQueryClient();
  return useMutation<MatchResult>({
    mutationFn: () => api.post<MatchResult>(`/api/jobs/${jobId}/match`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [JOBS_KEY, jobId] });
      qc.invalidateQueries({ queryKey: [JOBS_KEY] });
    },
  });
}
