"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type {
  InboxAction,
  InboxActionResponse,
  InboxListResponse,
} from "@/types/pulse-inbox";

export const PULSE_INBOX_KEY = "pulse-inbox";

export function usePulseInbox(
  classification?: string,
  limit = 20,
  offset = 0
) {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  if (classification) params.set("classification", classification);

  return useQuery<InboxListResponse>({
    queryKey: [PULSE_INBOX_KEY, classification, limit, offset],
    queryFn: () =>
      api.get<InboxListResponse>(`/api/pulse/inbox/?${params.toString()}`),
  });
}

export function useInboxAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      messageId,
      action,
    }: {
      messageId: number;
      action: InboxAction;
    }) =>
      api.post<InboxActionResponse>(
        `/api/pulse/inbox/${messageId}/action`,
        { action }
      ),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [PULSE_INBOX_KEY] });
      const labels: Record<string, string> = {
        to_task: "Saved as task",
        to_note: "Saved as note",
        skip: "Skipped",
      };
      toast.success(labels[data.action] || "Done");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Action failed");
    },
  });
}

export function useBulkInboxAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      messageIds,
      action,
    }: {
      messageIds: number[];
      action: InboxAction;
    }) =>
      api.post<InboxActionResponse>("/api/pulse/inbox/bulk-action", {
        message_ids: messageIds,
        action,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [PULSE_INBOX_KEY] });
      toast.success(`${data.processed} items processed`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Bulk action failed");
    },
  });
}
