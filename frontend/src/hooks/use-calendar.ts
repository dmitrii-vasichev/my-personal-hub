"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  CalendarEvent,
  CalendarEventCreate,
  CalendarEventDetail,
  CalendarEventUpdate,
  CalendarFilters,
  EventNote,
  EventNoteCreate,
  GoogleOAuthStatus,
} from "@/types/calendar";

export const CALENDAR_KEY = "calendar-events";
export const CALENDAR_OAUTH_KEY = "calendar-oauth-status";

// ── Events ────────────────────────────────────────────────────────────────────

export function useCalendarEvents(filters: CalendarFilters = {}) {
  const params = new URLSearchParams();
  if (filters.start) params.set("start", filters.start);
  if (filters.end) params.set("end", filters.end);
  const qs = params.toString() ? `?${params.toString()}` : "";

  return useQuery<CalendarEvent[]>({
    queryKey: [CALENDAR_KEY, filters],
    queryFn: () => api.get<CalendarEvent[]>(`/api/calendar/events/${qs}`),
  });
}

export function useCalendarEvent(eventId: number) {
  return useQuery<CalendarEventDetail>({
    queryKey: [CALENDAR_KEY, eventId],
    queryFn: () => api.get<CalendarEventDetail>(`/api/calendar/events/${eventId}`),
    enabled: !!eventId,
  });
}

export function useCreateCalendarEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CalendarEventCreate) =>
      api.post<CalendarEvent>("/api/calendar/events/", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [CALENDAR_KEY] }),
  });
}

export function useUpdateCalendarEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: CalendarEventUpdate }) =>
      api.patch<CalendarEvent>(`/api/calendar/events/${id}`, data),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: [CALENDAR_KEY] });
      qc.invalidateQueries({ queryKey: [CALENDAR_KEY, id] });
    },
  });
}

export function useDeleteCalendarEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/api/calendar/events/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [CALENDAR_KEY] }),
  });
}

// ── Event Notes ───────────────────────────────────────────────────────────────

export function useEventNotes(eventId: number) {
  return useQuery<EventNote[]>({
    queryKey: ["event-notes", eventId],
    queryFn: () => api.get<EventNote[]>(`/api/calendar/events/${eventId}/notes/`),
    enabled: !!eventId,
  });
}

export function useCreateEventNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId, data }: { eventId: number; data: EventNoteCreate }) =>
      api.post<EventNote>(`/api/calendar/events/${eventId}/notes/`, data),
    onSuccess: (_data, { eventId }) => {
      qc.invalidateQueries({ queryKey: ["event-notes", eventId] });
      qc.invalidateQueries({ queryKey: [CALENDAR_KEY, eventId] });
    },
  });
}

export function useUpdateEventNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ noteId, content }: { noteId: number; eventId: number; content: string }) =>
      api.patch<EventNote>(`/api/calendar/notes/${noteId}`, { content }),
    onSuccess: (_data, { eventId }) => {
      qc.invalidateQueries({ queryKey: ["event-notes", eventId] });
    },
  });
}

export function useDeleteEventNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ noteId }: { noteId: number; eventId: number }) =>
      api.delete(`/api/calendar/notes/${noteId}`),
    onSuccess: (_data, { eventId }) => {
      qc.invalidateQueries({ queryKey: ["event-notes", eventId] });
      qc.invalidateQueries({ queryKey: [CALENDAR_KEY, eventId] });
    },
  });
}

// ── Google OAuth ──────────────────────────────────────────────────────────────

export function useGoogleOAuthStatus() {
  return useQuery<GoogleOAuthStatus>({
    queryKey: [CALENDAR_OAUTH_KEY],
    queryFn: () => api.get<GoogleOAuthStatus>("/api/calendar/oauth/status"),
    staleTime: 60_000,
  });
}

export function useSyncCalendar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<{ pulled: number; pushed: number; error: string | null }>(
        "/api/calendar/sync",
        {}
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [CALENDAR_KEY] });
      qc.invalidateQueries({ queryKey: [CALENDAR_OAUTH_KEY] });
    },
  });
}

export function useDisconnectGoogle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/api/calendar/oauth/disconnect", {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: [CALENDAR_OAUTH_KEY] }),
  });
}
