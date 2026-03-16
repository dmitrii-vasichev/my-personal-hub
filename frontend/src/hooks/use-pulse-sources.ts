"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type {
  PulseSource,
  PulseSourceCreate,
  PulseSourceResolveResult,
  PulseSourceUpdate,
} from "@/types/pulse-source";

export const PULSE_SOURCES_KEY = "pulse-sources";

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
