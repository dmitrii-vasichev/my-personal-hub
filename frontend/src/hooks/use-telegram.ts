"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type {
  TelegramAuthStatus,
  TelegramStartAuthRequest,
  TelegramStartAuthResponse,
  TelegramVerifyCodeRequest,
} from "@/types/telegram";

export const TELEGRAM_STATUS_KEY = "telegram-status";

export function useTelegramStatus() {
  return useQuery<TelegramAuthStatus>({
    queryKey: [TELEGRAM_STATUS_KEY],
    queryFn: () => api.get<TelegramAuthStatus>("/api/pulse/telegram/status"),
  });
}

export function useTelegramStartAuth() {
  return useMutation({
    mutationFn: (data: TelegramStartAuthRequest) =>
      api.post<TelegramStartAuthResponse>("/api/pulse/telegram/start-auth", data),
    onSuccess: () => {
      toast.success("Verification code sent");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to start auth");
    },
  });
}

export function useTelegramVerifyCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: TelegramVerifyCodeRequest) =>
      api.post<TelegramAuthStatus>("/api/pulse/telegram/verify-code", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TELEGRAM_STATUS_KEY] });
      toast.success("Telegram connected successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Verification failed");
    },
  });
}

export function useTelegramDisconnect() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete("/api/pulse/telegram/disconnect"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TELEGRAM_STATUS_KEY] });
      toast.success("Telegram disconnected");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to disconnect");
    },
  });
}
