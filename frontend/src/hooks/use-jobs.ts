"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  CreateJobInput,
  Job,
  JobFilters,
  UpdateJobInput,
} from "@/types/job";

function buildJobQuery(filters: JobFilters = {}): string {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.company) params.set("company", filters.company);
  if (filters.source) params.set("source", filters.source);
  if (filters.has_application !== undefined)
    params.set("has_application", String(filters.has_application));
  if (filters.tags) params.set("tags", filters.tags);
  if (filters.sort_by) params.set("sort_by", filters.sort_by);
  if (filters.sort_order) params.set("sort_order", filters.sort_order);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const JOBS_KEY = "jobs";

export function useJobs(filters: JobFilters = {}) {
  const qs = buildJobQuery(filters);
  return useQuery<Job[]>({
    queryKey: [JOBS_KEY, filters],
    queryFn: () => api.get<Job[]>(`/api/jobs/${qs}`),
  });
}

export function useJob(id: number) {
  return useQuery<Job>({
    queryKey: [JOBS_KEY, id],
    queryFn: () => api.get<Job>(`/api/jobs/${id}`),
    enabled: !!id,
  });
}

export function useCreateJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateJobInput) => api.post<Job>("/api/jobs/", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [JOBS_KEY] });
    },
  });
}

export function useUpdateJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateJobInput }) =>
      api.patch<Job>(`/api/jobs/${id}`, data),
    onSuccess: (updatedJob) => {
      qc.invalidateQueries({ queryKey: [JOBS_KEY] });
      qc.setQueryData([JOBS_KEY, updatedJob.id], updatedJob);
    },
  });
}

export function useDeleteJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/api/jobs/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [JOBS_KEY] });
    },
  });
}
