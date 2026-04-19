"use client";

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type {
  UpdateTelegramPinRequest,
  UpdateTelegramUserIdRequest,
} from "@/types/telegram-bridge";

// Telegram→CC bridge (Phase 2): owner-only self-service mutations for
// wiring up the Telegram user id / PIN that the bot's check-sender and
// verify-pin endpoints consult.
//
// Note: the current user is stored in React state (see AuthProvider),
// not React Query, so there is no auth query to invalidate. Components
// that need the status badge to refresh after a mutation should call
// the `refreshUser()` function returned by `useAuth()` in their
// `onSuccess` / mutateAsync-then block.

export function useSetTelegramUserId() {
  return useMutation({
    mutationFn: (data: UpdateTelegramUserIdRequest) =>
      api.put<void>("/api/users/me/telegram-user-id", data),
    onError: (error: Error) => {
      toast.error(error.message || "Failed to save Telegram user id");
    },
  });
}

export function useSetTelegramPin() {
  return useMutation({
    mutationFn: (data: UpdateTelegramPinRequest) =>
      api.put<void>("/api/users/me/telegram-pin", data),
    onError: (error: Error) => {
      toast.error(error.message || "Failed to save PIN");
    },
  });
}
