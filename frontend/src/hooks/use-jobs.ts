"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  ChangeStatusInput,
  CreateJobInput,
  Job,
  JobFilters,
  KanbanCard,
  KanbanData,
  StatusHistoryEntry,
  UpdateJobInput,
  UpdateJobTrackingInput,
} from "@/types/job";

function buildJobQuery(filters: JobFilters = {}): string {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.company) params.set("company", filters.company);
  if (filters.source) params.set("source", filters.source);
  if (filters.status) params.set("status", filters.status);
  if (filters.tags) params.set("tags", filters.tags);
  if (filters.sort_by) params.set("sort_by", filters.sort_by);
  if (filters.sort_order) params.set("sort_order", filters.sort_order);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const JOBS_KEY = "jobs";
const KANBAN_KEY = "kanban";

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

export function useJobKanban() {
  return useQuery<KanbanData>({
    queryKey: [JOBS_KEY, KANBAN_KEY],
    queryFn: () => api.get<KanbanData>("/api/jobs/kanban"),
  });
}

export function useStatusHistory(jobId: number) {
  return useQuery<StatusHistoryEntry[]>({
    queryKey: [JOBS_KEY, jobId, "history"],
    queryFn: () =>
      api.get<StatusHistoryEntry[]>(`/api/jobs/${jobId}/history`),
    enabled: !!jobId,
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

export function useChangeJobStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: ChangeStatusInput }) =>
      api.patch<Job>(`/api/jobs/${id}/status`, data),

    // Optimistic update for kanban drag-and-drop
    onMutate: async ({ id, data }) => {
      await qc.cancelQueries({ queryKey: [JOBS_KEY, KANBAN_KEY] });

      const previousKanban = qc.getQueryData<KanbanData>([JOBS_KEY, KANBAN_KEY]);

      if (previousKanban) {
        let movedCard: KanbanCard | undefined;
        const updatedColumns = { ...previousKanban };

        (Object.keys(updatedColumns) as Array<keyof KanbanData>).forEach((col) => {
          const idx = updatedColumns[col].findIndex((c) => c.id === id);
          if (idx !== -1) {
            movedCard = updatedColumns[col][idx];
            updatedColumns[col] = [
              ...updatedColumns[col].slice(0, idx),
              ...updatedColumns[col].slice(idx + 1),
            ];
          }
        });

        if (movedCard) {
          const updatedCard: KanbanCard = {
            ...movedCard,
            status: data.new_status,
            updated_at: new Date().toISOString(),
          };
          const targetCol = data.new_status as keyof KanbanData;
          updatedColumns[targetCol] = [...updatedColumns[targetCol], updatedCard];
          qc.setQueryData([JOBS_KEY, KANBAN_KEY], updatedColumns);
        }
      }

      return { previousKanban };
    },

    onError: (_err, _vars, context) => {
      if (context?.previousKanban) {
        qc.setQueryData([JOBS_KEY, KANBAN_KEY], context.previousKanban);
      }
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: [JOBS_KEY] });
    },
  });
}

export function useUpdateJobTracking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateJobTrackingInput }) =>
      api.patch<Job>(`/api/jobs/${id}/tracking`, data),
    onSuccess: (updatedJob) => {
      qc.invalidateQueries({ queryKey: [JOBS_KEY] });
      qc.setQueryData([JOBS_KEY, updatedJob.id], updatedJob);
    },
  });
}
