"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { LinkedNoteBrief } from "@/types/note";
import { TASKS_KEY } from "./use-tasks";
import { JOBS_KEY } from "./use-jobs";
import { CALENDAR_KEY } from "./use-calendar";

// ── Task → Linked Notes ─────────────────────────────────────────────────────

export function useTaskLinkedNotes(taskId: number) {
  return useQuery<LinkedNoteBrief[]>({
    queryKey: [TASKS_KEY, taskId, "linked-notes"],
    queryFn: () =>
      api.get<LinkedNoteBrief[]>(`/api/tasks/${taskId}/linked-notes`),
    enabled: taskId > 0,
  });
}

export function useLinkNoteToTask(taskId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (noteId: number) =>
      api.post(`/api/notes/${noteId}/link-task/${taskId}`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [TASKS_KEY, taskId, "linked-notes"] });
    },
  });
}

export function useUnlinkNoteFromTask(taskId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (noteId: number) =>
      api.delete(`/api/notes/${noteId}/link-task/${taskId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [TASKS_KEY, taskId, "linked-notes"] });
    },
  });
}

// ── Job → Linked Notes ──────────────────────────────────────────────────────

export function useJobLinkedNotes(jobId: number) {
  return useQuery<LinkedNoteBrief[]>({
    queryKey: [JOBS_KEY, jobId, "linked-notes"],
    queryFn: () =>
      api.get<LinkedNoteBrief[]>(`/api/jobs/${jobId}/linked-notes`),
    enabled: jobId > 0,
  });
}

export function useLinkNoteToJob(jobId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (noteId: number) =>
      api.post(`/api/notes/${noteId}/link-job/${jobId}`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [JOBS_KEY, jobId, "linked-notes"] });
    },
  });
}

export function useUnlinkNoteFromJob(jobId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (noteId: number) =>
      api.delete(`/api/notes/${noteId}/link-job/${jobId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [JOBS_KEY, jobId, "linked-notes"] });
    },
  });
}

// ── Event → Linked Notes ────────────────────────────────────────────────────

export function useEventLinkedNotes(eventId: number) {
  return useQuery<LinkedNoteBrief[]>({
    queryKey: [CALENDAR_KEY, eventId, "linked-notes"],
    queryFn: () =>
      api.get<LinkedNoteBrief[]>(
        `/api/calendar/events/${eventId}/linked-notes`
      ),
    enabled: eventId > 0,
  });
}

export function useLinkNoteToEvent(eventId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (noteId: number) =>
      api.post(`/api/notes/${noteId}/link-event/${eventId}`, {}),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: [CALENDAR_KEY, eventId, "linked-notes"],
      });
    },
  });
}

export function useUnlinkNoteFromEvent(eventId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (noteId: number) =>
      api.delete(`/api/notes/${noteId}/link-event/${eventId}`),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: [CALENDAR_KEY, eventId, "linked-notes"],
      });
    },
  });
}
