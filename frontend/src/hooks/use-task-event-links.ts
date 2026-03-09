"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface LinkedEventBrief {
  id: number;
  title: string;
  start_time: string;
  end_time: string;
}

export interface LinkedTaskBrief {
  id: number;
  title: string;
  status: string;
  priority: string;
}

// ── Task → Events ──────────────────────────────────────────────────────────

export function useTaskLinkedEvents(taskId: number) {
  return useQuery<LinkedEventBrief[]>({
    queryKey: ["tasks", taskId, "events"],
    queryFn: () => api.get<LinkedEventBrief[]>(`/api/tasks/${taskId}/events`),
    enabled: taskId > 0,
  });
}

export function useLinkTaskToEvent(taskId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (eventId: number) =>
      api.post(`/api/tasks/${taskId}/events/${eventId}`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks", taskId, "events"] });
    },
  });
}

export function useUnlinkTaskFromEvent(taskId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (eventId: number) =>
      api.delete(`/api/tasks/${taskId}/events/${eventId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks", taskId, "events"] });
    },
  });
}

// ── Event → Tasks ──────────────────────────────────────────────────────────

export function useEventLinkedTasks(eventId: number) {
  return useQuery<LinkedTaskBrief[]>({
    queryKey: ["calendar", eventId, "tasks"],
    queryFn: () => api.get<LinkedTaskBrief[]>(`/api/calendar/events/${eventId}/tasks`),
    enabled: eventId > 0,
  });
}

export function useLinkEventToTask(eventId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId: number) =>
      api.post(`/api/calendar/events/${eventId}/tasks/${taskId}`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["calendar", eventId, "tasks"] });
    },
  });
}

export function useUnlinkEventFromTask(eventId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId: number) =>
      api.delete(`/api/calendar/events/${eventId}/tasks/${taskId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["calendar", eventId, "tasks"] });
    },
  });
}
