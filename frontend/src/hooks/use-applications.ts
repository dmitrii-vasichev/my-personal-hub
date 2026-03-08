"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  Application,
  ApplicationFilters,
  ChangeStatusInput,
  CreateApplicationInput,
  KanbanCard,
  KanbanData,
  StatusHistoryEntry,
  UpdateApplicationInput,
} from "@/types/job";
import { JOBS_KEY } from "@/hooks/use-jobs";

function buildApplicationQuery(filters: ApplicationFilters = {}): string {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.search) params.set("search", filters.search);
  if (filters.sort_by) params.set("sort_by", filters.sort_by);
  if (filters.sort_order) params.set("sort_order", filters.sort_order);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const APPLICATIONS_KEY = "applications";
const KANBAN_KEY = "kanban";

export function useApplications(filters: ApplicationFilters = {}) {
  const qs = buildApplicationQuery(filters);
  return useQuery<Application[]>({
    queryKey: [APPLICATIONS_KEY, filters],
    queryFn: () => api.get<Application[]>(`/api/applications/${qs}`),
  });
}

export function useApplication(id: number) {
  return useQuery<Application>({
    queryKey: [APPLICATIONS_KEY, id],
    queryFn: () => api.get<Application>(`/api/applications/${id}`),
    enabled: !!id,
  });
}

export function useApplicationKanban() {
  return useQuery<KanbanData>({
    queryKey: [APPLICATIONS_KEY, KANBAN_KEY],
    queryFn: () => api.get<KanbanData>("/api/applications/kanban"),
  });
}

export function useStatusHistory(applicationId: number) {
  return useQuery<StatusHistoryEntry[]>({
    queryKey: [APPLICATIONS_KEY, applicationId, "history"],
    queryFn: () =>
      api.get<StatusHistoryEntry[]>(
        `/api/applications/${applicationId}/history`,
      ),
    enabled: !!applicationId,
  });
}

export function useCreateApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateApplicationInput) =>
      api.post<Application>("/api/applications/", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [APPLICATIONS_KEY] });
      // Invalidate jobs because job.application summary field is now populated
      qc.invalidateQueries({ queryKey: [JOBS_KEY] });
    },
  });
}

export function useUpdateApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: UpdateApplicationInput;
    }) => api.patch<Application>(`/api/applications/${id}`, data),
    onSuccess: (updatedApplication) => {
      qc.invalidateQueries({ queryKey: [APPLICATIONS_KEY] });
      qc.setQueryData(
        [APPLICATIONS_KEY, updatedApplication.id],
        updatedApplication,
      );
    },
  });
}

export function useChangeApplicationStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: ChangeStatusInput }) =>
      api.patch<Application>(`/api/applications/${id}/status`, data),

    // Optimistic update: move the card in kanban cache before the API responds.
    // This ensures smooth drag-and-drop UX — the card visually moves instantly.
    onMutate: async ({ id, data }) => {
      // Cancel any outgoing kanban refetches to avoid race conditions
      await qc.cancelQueries({ queryKey: [APPLICATIONS_KEY, KANBAN_KEY] });

      // Snapshot the previous kanban state so we can roll back on error
      const previousKanban = qc.getQueryData<KanbanData>([
        APPLICATIONS_KEY,
        KANBAN_KEY,
      ]);

      if (previousKanban) {
        // Find the card in its current column and move it to the new status column
        let movedCard: KanbanCard | undefined;
        const updatedColumns = { ...previousKanban };

        // Remove card from whichever column currently holds it
        (
          Object.keys(updatedColumns) as Array<keyof KanbanData>
        ).forEach((col) => {
          const idx = updatedColumns[col].findIndex((c) => c.id === id);
          if (idx !== -1) {
            movedCard = updatedColumns[col][idx];
            updatedColumns[col] = [
              ...updatedColumns[col].slice(0, idx),
              ...updatedColumns[col].slice(idx + 1),
            ];
          }
        });

        // Insert card into the new column with updated status
        if (movedCard) {
          const updatedCard: KanbanCard = {
            ...movedCard,
            status: data.new_status,
            updated_at: new Date().toISOString(),
          };
          const targetCol = data.new_status as keyof KanbanData;
          updatedColumns[targetCol] = [
            ...updatedColumns[targetCol],
            updatedCard,
          ];
          qc.setQueryData([APPLICATIONS_KEY, KANBAN_KEY], updatedColumns);
        }
      }

      // Return snapshot for rollback
      return { previousKanban };
    },

    // Roll back optimistic update if the mutation fails
    onError: (_err, _vars, context) => {
      if (context?.previousKanban) {
        qc.setQueryData(
          [APPLICATIONS_KEY, KANBAN_KEY],
          context.previousKanban,
        );
      }
    },

    // Always refetch after error or success to sync server state
    onSettled: () => {
      qc.invalidateQueries({ queryKey: [APPLICATIONS_KEY] });
      qc.invalidateQueries({ queryKey: [JOBS_KEY] });
    },
  });
}

export function useDeleteApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/api/applications/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [APPLICATIONS_KEY] });
      // Invalidate jobs because job.application summary field is now cleared
      qc.invalidateQueries({ queryKey: [JOBS_KEY] });
    },
  });
}
