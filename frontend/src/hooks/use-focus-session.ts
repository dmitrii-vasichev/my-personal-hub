"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { focusSessionsApi } from "@/lib/api";
import type {
  FocusSession,
  FocusSessionTodayResponse,
  StartFocusBody,
} from "@/types/focus-session";

export const FOCUS_ACTIVE_KEY = ["focus-sessions", "active"] as const;
export const FOCUS_TODAY_KEY = ["focus-sessions", "today"] as const;
export const PLAN_TODAY_KEY = ["planner", "plans", "today"] as const;

export function useFocusSessionActive() {
  return useQuery<FocusSession | null>({
    queryKey: FOCUS_ACTIVE_KEY,
    queryFn: () => focusSessionsApi.getActive(),
    retry: false,
    staleTime: 30_000,
  });
}

export function useFocusSessionToday() {
  return useQuery<FocusSessionTodayResponse>({
    queryKey: FOCUS_TODAY_KEY,
    queryFn: () => focusSessionsApi.getToday(),
    retry: false,
    staleTime: 60_000,
  });
}

export function useStartFocusMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: StartFocusBody) => focusSessionsApi.start(body),
    onSuccess: (session) => {
      qc.setQueryData(FOCUS_ACTIVE_KEY, session);
      qc.invalidateQueries({ queryKey: FOCUS_TODAY_KEY });
    },
    onError: (err: unknown) => {
      const status = (err as { status?: number })?.status;
      if (status === 409) {
        toast.error("У тебя уже идёт сессия — останови её сначала");
      } else {
        toast.error("Не удалось стартовать фокус — попробуй ещё раз");
      }
    },
  });
}

export function useStopFocusMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => focusSessionsApi.stop(id),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: FOCUS_ACTIVE_KEY });
      const prev = qc.getQueryData<FocusSession | null>(FOCUS_ACTIVE_KEY);
      qc.setQueryData(FOCUS_ACTIVE_KEY, null);
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(FOCUS_ACTIVE_KEY, ctx.prev);
      toast.error("Не удалось остановить — попробуй ещё раз");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: FOCUS_ACTIVE_KEY });
      qc.invalidateQueries({ queryKey: FOCUS_TODAY_KEY });
      qc.invalidateQueries({ queryKey: PLAN_TODAY_KEY });
    },
  });
}
