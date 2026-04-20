"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { plannerApi } from "@/lib/api";
import type { DailyPlan, PatchPlanItemBody, PlanItem } from "@/types/plan";

export const PLAN_TODAY_KEY = ["planner", "plans", "today"] as const;

export function usePlanToday() {
  const query = useQuery<DailyPlan>({
    queryKey: PLAN_TODAY_KEY,
    queryFn: () => plannerApi.getPlansToday(),
    retry: false,
    staleTime: 30_000,
  });

  return {
    plan: query.data,
    isLoading: query.isLoading,
    error: query.error,
    hasPlan: !!query.data && !query.error,
    refetch: query.refetch,
  };
}

export function useCompleteItemMutation() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: PatchPlanItemBody }) =>
      plannerApi.patchTodayItem(id, body),
    onMutate: async ({ id, body }) => {
      await qc.cancelQueries({ queryKey: PLAN_TODAY_KEY });
      const prev = qc.getQueryData<DailyPlan>(PLAN_TODAY_KEY);
      qc.setQueryData<DailyPlan | undefined>(PLAN_TODAY_KEY, (p) => {
        if (!p) return p;
        return {
          ...p,
          items: p.items.map(
            (i): PlanItem =>
              i.id === id
                ? {
                    ...i,
                    status: body.status ?? i.status,
                    minutes_actual: body.minutes_actual ?? i.minutes_actual,
                  }
                : i,
          ),
        };
      });
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(PLAN_TODAY_KEY, ctx.prev);
      toast.error("Не удалось отметить — попробуй ещё раз");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PLAN_TODAY_KEY });
    },
  });
}
