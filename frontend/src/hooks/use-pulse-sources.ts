"use client";

import { useEffect, useRef, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type {
  PulseSource,
  PulseSourceCreate,
  PulseSourceResolveResult,
  PulseSourceUpdate,
  PollStatusResponse,
} from "@/types/pulse-source";

export const PULSE_SOURCES_KEY = "pulse-sources";
export const POLL_STATUS_KEY = "poll-status";

export function usePulseSources() {
  return useQuery<PulseSource[]>({
    queryKey: [PULSE_SOURCES_KEY],
    queryFn: () => api.get<PulseSource[]>("/api/pulse/sources/"),
  });
}

export function useCreatePulseSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: PulseSourceCreate) =>
      api.post<PulseSource>("/api/pulse/sources/", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PULSE_SOURCES_KEY] });
      toast.success("Source added");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to add source");
    },
  });
}

export function useUpdatePulseSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: PulseSourceUpdate }) =>
      api.patch<PulseSource>(`/api/pulse/sources/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PULSE_SOURCES_KEY] });
      toast.success("Source updated");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update source");
    },
  });
}

export function useDeletePulseSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/api/pulse/sources/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PULSE_SOURCES_KEY] });
      toast.success("Source removed");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to remove source");
    },
  });
}

export function useResolvePulseSource(identifier: string) {
  return useQuery<PulseSourceResolveResult>({
    queryKey: [PULSE_SOURCES_KEY, "resolve", identifier],
    queryFn: () =>
      api.get<PulseSourceResolveResult>(
        `/api/pulse/sources/resolve?identifier=${encodeURIComponent(identifier)}`
      ),
    enabled: identifier.length > 0,
  });
}

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes safety timeout

export function usePollStatus() {
  const queryClient = useQueryClient();
  const pollingActive = useRef(false);
  const startTime = useRef<number>(0);

  const query = useQuery<PollStatusResponse>({
    queryKey: [POLL_STATUS_KEY],
    queryFn: () => api.get<PollStatusResponse>("/api/pulse/sources/poll-status"),
    enabled: false,
    refetchInterval: false,
  });

  const stopPolling = useCallback(() => {
    pollingActive.current = false;
  }, []);

  const startPolling = useCallback(() => {
    pollingActive.current = true;
    startTime.current = Date.now();
    query.refetch();
  }, [query]);

  // Handle poll status changes
  useEffect(() => {
    if (!pollingActive.current || !query.data) return;

    // Safety timeout
    if (Date.now() - startTime.current > POLL_TIMEOUT_MS) {
      stopPolling();
      toast.info("Polling status check timed out");
      return;
    }

    if (query.data.any_polling) {
      // Still polling — schedule next check
      const timer = setTimeout(() => {
        if (pollingActive.current) {
          query.refetch();
        }
      }, POLL_INTERVAL_MS);
      return () => clearTimeout(timer);
    }

    // Polling finished — show results
    stopPolling();
    const sources = query.data.sources;
    const errorSources = sources.filter((s) => s.poll_status === "error");
    const totalMessages = sources.reduce((sum, s) => sum + s.last_poll_message_count, 0);

    if (errorSources.length > 0) {
      for (const s of errorSources) {
        toast.error(`Poll failed for ${s.title}: ${s.last_poll_error}`);
      }
    }

    const successCount = sources.length - errorSources.length;
    if (successCount > 0) {
      toast.success(
        totalMessages > 0
          ? `Poll complete: ${totalMessages} new message${totalMessages !== 1 ? "s" : ""}`
          : "Poll complete: no new messages"
      );
    }

    // Auto-refresh related data
    queryClient.invalidateQueries({ queryKey: [PULSE_SOURCES_KEY] });
    queryClient.invalidateQueries({ queryKey: ["pulse-inbox"] });
    queryClient.invalidateQueries({ queryKey: ["pulse-digests"] });
  }, [query.data, queryClient, stopPolling]);

  return { startPolling, stopPolling, data: query.data, isPolling: pollingActive.current };
}
