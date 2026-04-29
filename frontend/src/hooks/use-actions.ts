"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  Action,
  CreateActionInput,
  UpdateActionInput,
} from "@/types/action";

const ACTIONS_KEY = "actions";

export function useActions(includeDone = false) {
  return useQuery<Action[]>({
    queryKey: [ACTIONS_KEY, { includeDone }],
    queryFn: () =>
      api.get<Action[]>(`/api/actions/?include_done=${includeDone}`),
    refetchInterval: 30_000,
  });
}

export function useCreateAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateActionInput) =>
      api.post<Action>("/api/actions/", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [ACTIONS_KEY] }),
  });
}

export function useUpdateAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateActionInput & { id: number }) =>
      api.patch<Action>(`/api/actions/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [ACTIONS_KEY] }),
  });
}

export function useDeleteAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/api/actions/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [ACTIONS_KEY] }),
  });
}

export function useMarkActionDone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      api.post<Action>(`/api/actions/${id}/done`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [ACTIONS_KEY] }),
  });
}

export function useCompletedActions() {
  return useQuery<Action[]>({
    queryKey: [ACTIONS_KEY, { status: "done" }],
    queryFn: () => api.get<Action[]>("/api/actions/?status=done"),
  });
}

export function useRestoreAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      api.post<Action>(`/api/actions/${id}/restore`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [ACTIONS_KEY] }),
  });
}

export function useSnoozeAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, minutes }: { id: number; minutes: number }) =>
      api.post<Action>(`/api/actions/${id}/snooze`, { minutes }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [ACTIONS_KEY] }),
  });
}
