"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { VitalsDashboardSummary } from "@/types/vitals";

export function useVitalsDashboardSummary() {
  return useQuery<VitalsDashboardSummary | null>({
    queryKey: ["dashboard-vitals-summary"],
    queryFn: async () => {
      try {
        return await api.get<VitalsDashboardSummary>(
          "/api/dashboard/vitals-summary"
        );
      } catch {
        return null;
      }
    },
  });
}
