"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { JobHintResponse } from "@/types/calendar";

export const EVENT_JOB_HINT_KEY = "event-job-hint";

/**
 * GET /api/calendar/events/:id/job-hint — propose at most one job to
 * link this event to based on a case-insensitive substring match
 * against non-terminal jobs' company names. Returns null hints for
 * 0- or ≥2-match cases.
 *
 * ``eventId === null`` short-circuits the fetch; useful in dialogs
 * that render before the event is known (e.g. create-mode).
 */
export function useEventJobHint(eventId: number | null) {
  return useQuery<JobHintResponse>({
    queryKey: [EVENT_JOB_HINT_KEY, eventId],
    queryFn: () =>
      api.get<JobHintResponse>(
        `/api/calendar/events/${eventId}/job-hint`,
      ),
    enabled: eventId !== null,
    staleTime: 60_000,
  });
}
