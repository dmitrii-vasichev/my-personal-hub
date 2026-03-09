"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { UpdateSettingsInput, UserSettings } from "@/types/settings";

export const SETTINGS_KEY = "settings";

export function useSettings() {
  return useQuery<UserSettings>({
    queryKey: [SETTINGS_KEY],
    queryFn: () => api.get<UserSettings>("/api/settings/"),
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateSettingsInput) =>
      api.put<UserSettings>("/api/settings/", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SETTINGS_KEY] });
    },
  });
}
