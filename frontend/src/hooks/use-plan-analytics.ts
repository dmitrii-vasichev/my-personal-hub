"use client";

import { useQuery } from "@tanstack/react-query";
import { plannerApi } from "@/lib/api";

function ymd(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export function usePlanAnalytics() {
  const current = useQuery({
    queryKey: ["planner", "analytics", "7d"],
    queryFn: () => plannerApi.getAnalytics(ymd(-6), ymd(0)),
    staleTime: 5 * 60_000,
    retry: false,
  });

  const prior = useQuery({
    queryKey: ["planner", "analytics", "7d-prior"],
    queryFn: () => plannerApi.getAnalytics(ymd(-13), ymd(-7)),
    staleTime: 5 * 60_000,
    retry: false,
  });

  const deltaPct =
    current.data?.avg_adherence != null && prior.data?.avg_adherence != null
      ? Math.round(
          (current.data.avg_adherence - prior.data.avg_adherence) * 100,
        )
      : null;

  return {
    current: current.data,
    prior: prior.data,
    isLoading: current.isLoading || prior.isLoading,
    deltaPct,
  };
}
