"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  Reminder,
  CreateReminderInput,
  UpdateReminderInput,
} from "@/types/reminder";

const REMINDERS_KEY = "reminders";

export function useReminders(includeDone = false) {
  return useQuery<Reminder[]>({
    queryKey: [REMINDERS_KEY, { includeDone }],
    queryFn: () =>
      api.get<Reminder[]>(`/api/reminders/?include_done=${includeDone}`),
    refetchInterval: 30_000,
  });
}

export function useCreateReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateReminderInput) =>
      api.post<Reminder>("/api/reminders/", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [REMINDERS_KEY] }),
  });
}

export function useUpdateReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateReminderInput & { id: number }) =>
      api.patch<Reminder>(`/api/reminders/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [REMINDERS_KEY] }),
  });
}

export function useDeleteReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/api/reminders/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [REMINDERS_KEY] }),
  });
}

export function useMarkDone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      api.post<Reminder>(`/api/reminders/${id}/done`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [REMINDERS_KEY] }),
  });
}

export function useCompletedReminders() {
  return useQuery<Reminder[]>({
    queryKey: [REMINDERS_KEY, { status: "done" }],
    queryFn: () => api.get<Reminder[]>("/api/reminders/?status=done"),
  });
}

export function useRestoreReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      api.post<Reminder>(`/api/reminders/${id}/restore`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [REMINDERS_KEY] }),
  });
}

export function useSnoozeReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, minutes }: { id: number; minutes: number }) =>
      api.post<Reminder>(`/api/reminders/${id}/snooze`, { minutes }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [REMINDERS_KEY] }),
  });
}
