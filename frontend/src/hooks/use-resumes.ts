"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { CoverLetter, Resume } from "@/types/resume";

const RESUMES_KEY = "resumes";
const COVER_LETTERS_KEY = "cover_letters";

export function useResumes(jobId: number) {
  return useQuery<Resume[]>({
    queryKey: [RESUMES_KEY, jobId],
    queryFn: () => api.get<Resume[]>(`/api/resumes/job/${jobId}`),
    enabled: !!jobId,
  });
}

export function useGenerateResume() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (jobId: number) =>
      api.post<Resume>("/api/resumes/generate", { job_id: jobId }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [RESUMES_KEY, data.job_id] });
    },
  });
}

export function useRunAtsAudit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (resumeId: number) =>
      api.post<Resume>(`/api/resumes/${resumeId}/ats-audit`, {}),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [RESUMES_KEY, data.job_id] });
    },
  });
}

export function useRunGapAnalysis() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (resumeId: number) =>
      api.post<Resume>(`/api/resumes/${resumeId}/gap-analysis`, {}),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [RESUMES_KEY, data.job_id] });
    },
  });
}

export function useCoverLetters(jobId: number) {
  return useQuery<CoverLetter[]>({
    queryKey: [COVER_LETTERS_KEY, jobId],
    queryFn: () => api.get<CoverLetter[]>(`/api/cover-letters/job/${jobId}`),
    enabled: !!jobId,
  });
}

export function useGenerateCoverLetter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (jobId: number) =>
      api.post<CoverLetter>("/api/cover-letters/generate", { job_id: jobId }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [COVER_LETTERS_KEY, data.job_id] });
    },
  });
}
