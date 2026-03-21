"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type {
  VitalsTodayResponse,
  VitalsDailyMetric,
  VitalsSleep,
  VitalsActivity,
  VitalsBriefing,
  VitalsConnectionStatus,
  VitalsDashboardSummary,
} from "@/types/vitals";

export const VITALS_KEY = "vitals";

export function useVitalsConnection() {
  return useQuery<VitalsConnectionStatus>({
    queryKey: [VITALS_KEY, "connection"],
    queryFn: () => api.get<VitalsConnectionStatus>("/api/vitals/connection"),
  });
}

export function useVitalsToday() {
  return useQuery<VitalsTodayResponse>({
    queryKey: [VITALS_KEY, "today"],
    queryFn: () => api.get<VitalsTodayResponse>("/api/vitals/today"),
  });
}

export function useVitalsMetrics(startDate?: string, endDate?: string) {
  const params = new URLSearchParams();
  if (startDate) params.set("start_date", startDate);
  if (endDate) params.set("end_date", endDate);
  const qs = params.toString();

  return useQuery<VitalsDailyMetric[]>({
    queryKey: [VITALS_KEY, "metrics", startDate, endDate],
    queryFn: () =>
      api.get<VitalsDailyMetric[]>(`/api/vitals/metrics${qs ? `?${qs}` : ""}`),
  });
}

export function useVitalsSleep(startDate?: string, endDate?: string) {
  const params = new URLSearchParams();
  if (startDate) params.set("start_date", startDate);
  if (endDate) params.set("end_date", endDate);
  const qs = params.toString();

  return useQuery<VitalsSleep[]>({
    queryKey: [VITALS_KEY, "sleep", startDate, endDate],
    queryFn: () =>
      api.get<VitalsSleep[]>(`/api/vitals/sleep${qs ? `?${qs}` : ""}`),
  });
}

export function useVitalsActivities(
  startDate?: string,
  endDate?: string,
  limit = 20,
  offset = 0
) {
  const params = new URLSearchParams();
  if (startDate) params.set("start_date", startDate);
  if (endDate) params.set("end_date", endDate);
  params.set("limit", String(limit));
  params.set("offset", String(offset));

  return useQuery<VitalsActivity[]>({
    queryKey: [VITALS_KEY, "activities", startDate, endDate, limit, offset],
    queryFn: () =>
      api.get<VitalsActivity[]>(`/api/vitals/activities?${params.toString()}`),
  });
}

export function useVitalsBriefing(date?: string) {
  const qs = date ? `?date=${date}` : "";
  return useQuery<VitalsBriefing | null>({
    queryKey: [VITALS_KEY, "briefing", date],
    queryFn: () => api.get<VitalsBriefing | null>(`/api/vitals/briefing${qs}`),
  });
}

export function useGenerateBriefing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<VitalsBriefing>("/api/vitals/briefing/generate"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [VITALS_KEY, "briefing"] });
      toast.success("Briefing generated");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to generate briefing");
    },
  });
}

export function useSyncVitals() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<VitalsConnectionStatus>("/api/vitals/sync"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [VITALS_KEY] });
      toast.success("Sync completed");
    },
    onError: (error: Error) => {
      // Refetch connection status to get updated rate_limited_until
      queryClient.invalidateQueries({ queryKey: [VITALS_KEY, "connection"] });
      toast.error(error.message || "Failed to sync");
    },
  });
}

export function useVitalsDashboardSummary() {
  return useQuery<VitalsDashboardSummary>({
    queryKey: [VITALS_KEY, "dashboard"],
    queryFn: () => api.get<VitalsDashboardSummary>("/api/dashboard/vitals-summary"),
  });
}
