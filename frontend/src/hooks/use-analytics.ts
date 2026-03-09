"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  AnalyticsSummary,
  FunnelItem,
  SkillItem,
  SourceItem,
  TimelinePoint,
} from "@/types/analytics";

export function useAnalyticsSummary() {
  return useQuery<AnalyticsSummary>({
    queryKey: ["analytics", "summary"],
    queryFn: () => api.get<AnalyticsSummary>("/api/analytics/summary"),
  });
}

export function useAnalyticsFunnel() {
  return useQuery<FunnelItem[]>({
    queryKey: ["analytics", "funnel"],
    queryFn: () => api.get<FunnelItem[]>("/api/analytics/funnel"),
  });
}

export function useAnalyticsTimeline(weeks = 12) {
  return useQuery<TimelinePoint[]>({
    queryKey: ["analytics", "timeline", weeks],
    queryFn: () => api.get<TimelinePoint[]>(`/api/analytics/timeline?weeks=${weeks}`),
  });
}

export function useAnalyticsSkills(topN = 15) {
  return useQuery<SkillItem[]>({
    queryKey: ["analytics", "skills", topN],
    queryFn: () => api.get<SkillItem[]>(`/api/analytics/skills?top_n=${topN}`),
  });
}

export function useAnalyticsSources() {
  return useQuery<SourceItem[]>({
    queryKey: ["analytics", "sources"],
    queryFn: () => api.get<SourceItem[]>("/api/analytics/sources"),
  });
}
