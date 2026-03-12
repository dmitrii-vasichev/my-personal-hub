"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Tag, CreateTagInput, UpdateTagInput, BulkTagRequest, BulkTagResponse } from "@/types/tag";
import { KANBAN_KEY, TASKS_KEY } from "./use-tasks";

export const TAGS_KEY = "tags";

export function useTags() {
  return useQuery<Tag[]>({
    queryKey: [TAGS_KEY],
    queryFn: () => api.get<Tag[]>("/api/tags"),
  });
}

export function useCreateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTagInput) => api.post<Tag>("/api/tags", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [TAGS_KEY] });
    },
  });
}

export function useUpdateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tagId, data }: { tagId: number; data: UpdateTagInput }) =>
      api.patch<Tag>(`/api/tags/${tagId}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [TAGS_KEY] });
    },
  });
}

export function useDeleteTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tagId: number) => api.delete(`/api/tags/${tagId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [TAGS_KEY] });
      qc.invalidateQueries({ queryKey: [KANBAN_KEY] });
      qc.invalidateQueries({ queryKey: [TASKS_KEY] });
    },
  });
}

export function useBulkTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: BulkTagRequest) =>
      api.post<BulkTagResponse>("/api/tasks/bulk-tag", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [TAGS_KEY] });
      qc.invalidateQueries({ queryKey: [KANBAN_KEY] });
      qc.invalidateQueries({ queryKey: [TASKS_KEY] });
    },
  });
}
