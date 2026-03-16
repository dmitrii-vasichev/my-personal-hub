"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type {
  DigestGenerateResponse,
  DigestListResponse,
  PulseDigest,
} from "@/types/pulse-digest";

export const PULSE_DIGESTS_KEY = "pulse-digests";

export function useDigests(limit = 20, offset = 0, category?: string) {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  if (category) params.set("category", category);

  return useQuery<DigestListResponse>({
    queryKey: [PULSE_DIGESTS_KEY, "list", limit, offset, category],
    queryFn: () =>
      api.get<DigestListResponse>(`/api/pulse/digests/?${params.toString()}`),
  });
}

export function useLatestDigest(category?: string) {
  const params = category ? `?category=${encodeURIComponent(category)}` : "";
  return useQuery<PulseDigest | null>({
    queryKey: [PULSE_DIGESTS_KEY, "latest", category],
    queryFn: () => api.get<PulseDigest | null>(`/api/pulse/digests/latest${params}`),
  });
}

export function useDigest(id: number | null) {
  return useQuery<PulseDigest>({
    queryKey: [PULSE_DIGESTS_KEY, "detail", id],
    queryFn: () => api.get<PulseDigest>(`/api/pulse/digests/${id}`),
    enabled: id !== null,
  });
}

export function useGenerateDigest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (category?: string) =>
      api.post<DigestGenerateResponse>("/api/pulse/digests/generate", {
        category: category || null,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [PULSE_DIGESTS_KEY] });
      toast.success(data.message);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to generate digest");
    },
  });
}
