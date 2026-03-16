"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { PulseSettings, PulseSettingsUpdate } from "@/types/pulse-settings";

export const PULSE_SETTINGS_KEY = "pulse-settings";

export function usePulseSettings() {
  return useQuery<PulseSettings>({
    queryKey: [PULSE_SETTINGS_KEY],
    queryFn: () => api.get<PulseSettings>("/api/pulse/settings/"),
  });
}

export function useUpdatePulseSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: PulseSettingsUpdate) =>
      api.put<PulseSettings>("/api/pulse/settings/", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PULSE_SETTINGS_KEY] });
      toast.success("Pulse settings saved");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to save settings");
    },
  });
}

export function useTriggerPoll() {
  return useMutation({
    mutationFn: () =>
      api.post<{ ok: boolean; detail: string; sources_count: number }>(
        "/api/pulse/sources/poll"
      ),
    onSuccess: (data) => {
      toast.success(`Polling started for ${data.sources_count} sources`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to trigger poll");
    },
  });
}
