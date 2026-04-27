"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { PULSE_DIGESTS_KEY } from "@/hooks/use-pulse-digests";
import type {
  DigestItemAction,
  DigestItemListResponse,
  PulseUnreadCountResponse,
} from "@/types/pulse-digest";

export const PULSE_DIGEST_ITEMS_KEY = "pulse-digest-items";
export const PULSE_UNREAD_COUNT_KEY = "pulse-unread-count";

export function useDigestItems(
  digestId: number | null,
  options?: { classification?: string; status?: string; limit?: number; offset?: number }
) {
  const params = new URLSearchParams();
  if (options?.classification) params.set("classification", options.classification);
  if (options?.status) params.set("status", options.status);
  if (options?.limit) params.set("limit", String(options.limit));
  if (options?.offset) params.set("offset", String(options.offset));

  const qs = params.toString();
  const url = `/api/pulse/digests/${digestId}/items${qs ? `?${qs}` : ""}`;

  return useQuery<DigestItemListResponse>({
    queryKey: [PULSE_DIGEST_ITEMS_KEY, digestId, options?.classification, options?.status, options?.limit, options?.offset],
    queryFn: () => api.get<DigestItemListResponse>(url),
    enabled: digestId !== null,
  });
}

export function useLatestDigestItems(category: string) {
  return useQuery<DigestItemListResponse>({
    queryKey: [PULSE_DIGEST_ITEMS_KEY, "latest", category],
    queryFn: () =>
      api.get<DigestItemListResponse>(
        `/api/pulse/digests/latest/items?category=${encodeURIComponent(category)}`
      ),
  });
}

export function usePulseUnreadCount() {
  return useQuery<PulseUnreadCountResponse>({
    queryKey: [PULSE_UNREAD_COUNT_KEY],
    queryFn: () =>
      api.get<PulseUnreadCountResponse>(
        "/api/pulse/digests/items/unread-count"
      ),
  });
}

export function useDigestItemAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, action }: { itemId: number; action: DigestItemAction }) =>
      api.post(`/api/pulse/digests/items/${itemId}/action`, { action }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [PULSE_DIGEST_ITEMS_KEY] });
      queryClient.invalidateQueries({ queryKey: [PULSE_DIGESTS_KEY] });
      queryClient.invalidateQueries({ queryKey: [PULSE_UNREAD_COUNT_KEY] });
      const labels: Record<string, string> = {
        to_task: "Saved as task",
        to_note: "Saved as note",
        to_job: "Added to Job Hunt",
        skip: "Skipped",
      };
      toast.success(labels[variables.action] || "Done");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Action failed");
    },
  });
}

export function useMarkDigestItemRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, read }: { itemId: number; read: boolean }) =>
      api.patch(`/api/pulse/digests/items/${itemId}/read`, { read }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PULSE_DIGEST_ITEMS_KEY] });
      queryClient.invalidateQueries({ queryKey: [PULSE_UNREAD_COUNT_KEY] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Read state update failed");
    },
  });
}

export function useBulkDigestItemAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemIds, action }: { itemIds: number[]; action: DigestItemAction }) =>
      api.post("/api/pulse/digests/items/bulk-action", {
        item_ids: itemIds,
        action,
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [PULSE_DIGEST_ITEMS_KEY] });
      queryClient.invalidateQueries({ queryKey: [PULSE_DIGESTS_KEY] });
      queryClient.invalidateQueries({ queryKey: [PULSE_UNREAD_COUNT_KEY] });
      toast.success(`${variables.itemIds.length} items processed`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Bulk action failed");
    },
  });
}
