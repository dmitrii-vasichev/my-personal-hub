"use client";

import { useQuery } from "@tanstack/react-query";
import { plannerApi } from "@/lib/api";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function usePlannerContext() {
  const q = useQuery({
    queryKey: ["planner", "context", today()],
    queryFn: () => plannerApi.getContext(today()),
    staleTime: 60_000,
    retry: false,
  });
  return { context: q.data, isLoading: q.isLoading, error: q.error };
}
