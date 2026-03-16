"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { PulseDigest } from "@/types/pulse-digest";

export function useDashboardPulse() {
  return useQuery<PulseDigest | null>({
    queryKey: ["dashboard-pulse-latest"],
    queryFn: async () => {
      try {
        return await api.get<PulseDigest>("/api/pulse/digests/latest");
      } catch {
        return null;
      }
    },
  });
}
