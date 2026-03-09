"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { CoverLetter, Resume } from "@/types/resume";

const RESUMES_KEY = "resumes";
const COVER_LETTERS_KEY = "cover_letters";

export function useResumes(applicationId: number) {
  return useQuery<Resume[]>({
    queryKey: [RESUMES_KEY, applicationId],
    queryFn: () => api.get<Resume[]>(`/api/resumes/application/${applicationId}`),
    enabled: !!applicationId,
  });
}

export function useGenerateResume() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (applicationId: number) =>
      api.post<Resume>("/api/resumes/generate", { application_id: applicationId }),
    onSuccess: (_, applicationId) => {
      queryClient.invalidateQueries({ queryKey: [RESUMES_KEY, applicationId] });
    },
  });
}

export function useRunAtsAudit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (resumeId: number) =>
      api.post<Resume>(`/api/resumes/${resumeId}/ats-audit`, {}),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [RESUMES_KEY, data.application_id] });
    },
  });
}

export function useRunGapAnalysis() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (resumeId: number) =>
      api.post<Resume>(`/api/resumes/${resumeId}/gap-analysis`, {}),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [RESUMES_KEY, data.application_id] });
    },
  });
}

export function useCoverLetters(applicationId: number) {
  return useQuery<CoverLetter[]>({
    queryKey: [COVER_LETTERS_KEY, applicationId],
    queryFn: () => api.get<CoverLetter[]>(`/api/cover-letters/application/${applicationId}`),
    enabled: !!applicationId,
  });
}

export function useGenerateCoverLetter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (applicationId: number) =>
      api.post<CoverLetter>("/api/cover-letters/generate", { application_id: applicationId }),
    onSuccess: (_, applicationId) => {
      queryClient.invalidateQueries({ queryKey: [COVER_LETTERS_KEY, applicationId] });
    },
  });
}
