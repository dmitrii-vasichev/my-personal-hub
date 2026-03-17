"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { PulseSummaryResponse } from "@/types/pulse-digest";

export function useDashboardPulse() {
  return useQuery<PulseSummaryResponse | null>({
    queryKey: ["dashboard-pulse-summary"],
    queryFn: async () => {
      try {
        return await api.get<PulseSummaryResponse>(
          "/api/dashboard/pulse-summary"
        );
      } catch {
        return null;
      }
    },
  });
}
