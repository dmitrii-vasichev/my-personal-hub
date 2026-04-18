"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  ApiTokenCreateResponse,
  ApiTokenListItem,
} from "@/types/api-token";

export const API_TOKENS_KEY = "api-tokens";

export function useApiTokens() {
  return useQuery<ApiTokenListItem[]>({
    queryKey: [API_TOKENS_KEY],
    queryFn: () => api.get<ApiTokenListItem[]>("/api/auth/tokens"),
  });
}

export function useCreateApiToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string }) =>
      api.post<ApiTokenCreateResponse>("/api/auth/tokens", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [API_TOKENS_KEY] });
    },
  });
}

export function useRevokeApiToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/api/auth/tokens/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [API_TOKENS_KEY] });
    },
  });
}
