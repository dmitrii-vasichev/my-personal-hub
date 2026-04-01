"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  BatchJobResponse,
  BatchPrepareInput,
  BatchPrepareResponse,
  BatchSendInput,
  ChangeLeadStatusInput,
  CheckDuplicatesInput,
  CheckDuplicatesResponse,
  CreateActivityInput,
  CreateLeadInput,
  CreateIndustryInput,
  GmailStatus,
  GenerateProposalInput,
  Industry,
  Lead,
  LeadActivity,
  LeadFilters,
  LeadKanbanCard,
  LeadKanbanData,
  LeadStatusHistoryEntry,
  OutreachAnalytics,
  PdfParseResponse,
  SendEmailInput,
  UpdateIndustryInput,
  UpdateLeadInput,
} from "@/types/lead";

function buildLeadQuery(filters: LeadFilters = {}): string {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.status) params.set("status", filters.status);
  if (filters.industry_id) params.set("industry_id", String(filters.industry_id));
  if (filters.source) params.set("source", filters.source);
  if (filters.sort_by) params.set("sort_by", filters.sort_by);
  if (filters.sort_order) params.set("sort_order", filters.sort_order);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const LEADS_KEY = "leads";
const KANBAN_KEY = "leads-kanban";
const INDUSTRIES_KEY = "industries";

// ── Lead queries ────────────────────────────────────────────────────────────

export function useLeads(filters: LeadFilters = {}) {
  const qs = buildLeadQuery(filters);
  return useQuery<Lead[]>({
    queryKey: [LEADS_KEY, filters],
    queryFn: () => api.get<Lead[]>(`/api/leads/${qs}`),
  });
}

export function useLead(id: number) {
  return useQuery<Lead>({
    queryKey: [LEADS_KEY, id],
    queryFn: () => api.get<Lead>(`/api/leads/${id}`),
    enabled: !!id,
  });
}

export function useLeadKanban() {
  return useQuery<LeadKanbanData>({
    queryKey: [LEADS_KEY, KANBAN_KEY],
    queryFn: () => api.get<LeadKanbanData>("/api/leads/kanban"),
  });
}

export function useLeadStatusHistory(leadId: number) {
  return useQuery<LeadStatusHistoryEntry[]>({
    queryKey: [LEADS_KEY, leadId, "history"],
    queryFn: () => api.get<LeadStatusHistoryEntry[]>(`/api/leads/${leadId}/history`),
    enabled: !!leadId,
  });
}

export function useLeadActivities(leadId: number) {
  return useQuery<LeadActivity[]>({
    queryKey: [LEADS_KEY, leadId, "activities"],
    queryFn: () => api.get<LeadActivity[]>(`/api/leads/${leadId}/activities`),
    enabled: !!leadId,
  });
}

// ── Lead mutations ──────────────────────────────────────────────────────────

export function useCreateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateLeadInput) => api.post<Lead>("/api/leads/", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [LEADS_KEY] });
    },
  });
}

export function useUpdateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateLeadInput }) =>
      api.patch<Lead>(`/api/leads/${id}`, data),
    onSuccess: (updatedLead) => {
      qc.invalidateQueries({ queryKey: [LEADS_KEY] });
      qc.setQueryData([LEADS_KEY, updatedLead.id], updatedLead);
    },
  });
}

export function useDeleteLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/api/leads/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [LEADS_KEY] });
    },
  });
}

export function useChangeLeadStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: ChangeLeadStatusInput }) =>
      api.patch<Lead>(`/api/leads/${id}/status`, data),

    // Optimistic update for kanban drag-and-drop
    onMutate: async ({ id, data }) => {
      await qc.cancelQueries({ queryKey: [LEADS_KEY, KANBAN_KEY] });

      const previousKanban = qc.getQueryData<LeadKanbanData>([LEADS_KEY, KANBAN_KEY]);

      if (previousKanban) {
        let movedCard: LeadKanbanCard | undefined;
        const updatedColumns = { ...previousKanban };

        (Object.keys(updatedColumns) as Array<keyof LeadKanbanData>).forEach((col) => {
          const idx = updatedColumns[col].findIndex((c) => c.id === id);
          if (idx !== -1) {
            movedCard = updatedColumns[col][idx];
            updatedColumns[col] = [
              ...updatedColumns[col].slice(0, idx),
              ...updatedColumns[col].slice(idx + 1),
            ];
          }
        });

        if (movedCard) {
          const updatedCard: LeadKanbanCard = {
            ...movedCard,
            status: data.new_status,
            updated_at: new Date().toISOString(),
          };
          const targetCol = data.new_status as keyof LeadKanbanData;
          updatedColumns[targetCol] = [...updatedColumns[targetCol], updatedCard];
          qc.setQueryData([LEADS_KEY, KANBAN_KEY], updatedColumns);
        }
      }

      return { previousKanban };
    },

    onError: (_err, _vars, context) => {
      if (context?.previousKanban) {
        qc.setQueryData([LEADS_KEY, KANBAN_KEY], context.previousKanban);
      }
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: [LEADS_KEY] });
    },
  });
}

// ── Activity mutations ─────────────────────────────────────────────────────

export function useCreateActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ leadId, data }: { leadId: number; data: CreateActivityInput }) =>
      api.post<LeadActivity>(`/api/leads/${leadId}/activities`, data),
    onSuccess: (_result, { leadId }) => {
      qc.invalidateQueries({ queryKey: [LEADS_KEY, leadId, "activities"] });
    },
  });
}

export function useDeleteActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ activityId, leadId }: { activityId: number; leadId: number }) =>
      api.delete(`/api/leads/activities/${activityId}`),
    onSuccess: (_result, { leadId }) => {
      qc.invalidateQueries({ queryKey: [LEADS_KEY, leadId, "activities"] });
    },
  });
}

// ── Gmail ──────────────────────────────────────────────────────────────────

const GMAIL_KEY = "gmail-status";

export function useGmailStatus() {
  return useQuery<GmailStatus>({
    queryKey: [GMAIL_KEY],
    queryFn: () => api.get<GmailStatus>("/api/gmail/status"),
    staleTime: 60_000,
  });
}

export function useSendEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ leadId, data }: { leadId: number; data: SendEmailInput }) =>
      api.post<LeadActivity>(`/api/gmail/leads/${leadId}/send-email`, data),
    onSuccess: (_result, { leadId }) => {
      qc.invalidateQueries({ queryKey: [LEADS_KEY, leadId, "activities"] });
      qc.invalidateQueries({ queryKey: [LEADS_KEY, leadId, "history"] });
      qc.invalidateQueries({ queryKey: [LEADS_KEY] });
    },
  });
}

export function useCheckReplies() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<{ threads_checked: number; new_replies: number; status_transitions: number }>(
        "/api/gmail/check-replies",
        {}
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [LEADS_KEY] });
    },
  });
}

// ── Proposal generation ────────────────────────────────────────────────────

export function useGenerateProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data?: GenerateProposalInput;
    }) => api.post<Lead>(`/api/leads/${id}/generate-proposal`, data ?? {}),
    onSuccess: (updatedLead) => {
      qc.invalidateQueries({ queryKey: [LEADS_KEY] });
      qc.setQueryData([LEADS_KEY, updatedLead.id], updatedLead);
    },
  });
}

// ── Analytics ───────────────────────────────────────────────────────────────

export function useOutreachAnalytics() {
  return useQuery<OutreachAnalytics>({
    queryKey: [LEADS_KEY, "analytics"],
    queryFn: () => api.get<OutreachAnalytics>("/api/leads/analytics"),
  });
}

// ── Duplicate detection ─────────────────────────────────────────────────────

export function useCheckDuplicates() {
  return useMutation({
    mutationFn: (data: CheckDuplicatesInput) =>
      api.post<CheckDuplicatesResponse>("/api/leads/check-duplicates", data),
  });
}

// ── PDF parsing ────────────────────────────────────────────────────────────

export function useParsePdf() {
  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return api.upload<PdfParseResponse>("/api/leads/parse-pdf", formData);
    },
  });
}

export function useBatchCreateLeads() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (leads: CreateLeadInput[]) =>
      api.post<Lead[]>("/api/leads/batch", { leads }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [LEADS_KEY] });
    },
  });
}

// ── Industry queries & mutations ────────────────────────────────────────────

export function useIndustries() {
  return useQuery<Industry[]>({
    queryKey: [INDUSTRIES_KEY],
    queryFn: () => api.get<Industry[]>("/api/industries/"),
  });
}

export function useCreateIndustry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateIndustryInput) => api.post<Industry>("/api/industries/", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [INDUSTRIES_KEY] });
    },
  });
}

export function useUpdateIndustry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateIndustryInput }) =>
      api.patch<Industry>(`/api/industries/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [INDUSTRIES_KEY] });
    },
  });
}

export function useDeleteIndustry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/api/industries/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [INDUSTRIES_KEY] });
    },
  });
}

export function useExportIndustryCases() {
  return useMutation({
    mutationFn: () => api.get<{ markdown: string }>("/api/industries/cases/export"),
  });
}

export function useImportIndustryCases() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { markdown_content: string }) =>
      api.post<{ matched_count: number; updated_count: number }>(
        "/api/industries/cases/import",
        data
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [INDUSTRIES_KEY] });
    },
  });
}

export function useGenerateIndustryInstructions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      language,
    }: {
      id: number;
      language: string;
    }) => api.post<Industry>(`/api/industries/${id}/generate-instructions`, { language }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [INDUSTRIES_KEY] });
    },
  });
}

// ── Batch outreach ─────────────────────────────────────────────────────────

const BATCH_KEY = "batch-outreach";

export function usePrepareBatch() {
  return useMutation({
    mutationFn: (data: BatchPrepareInput) =>
      api.post<BatchPrepareResponse>("/api/outreach/batch/prepare", data),
  });
}

export function useSendBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: BatchSendInput) =>
      api.post<BatchJobResponse>("/api/outreach/batch/send", data),
    onSuccess: (job) => {
      qc.setQueryData([BATCH_KEY, job.id], job);
    },
  });
}

export function useBatchJob(jobId: number | null) {
  return useQuery<BatchJobResponse>({
    queryKey: [BATCH_KEY, jobId],
    queryFn: () => api.get<BatchJobResponse>(`/api/outreach/batch/${jobId}`),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const data = query.state.data;
      // Poll every 5s while sending
      if (data?.status === "sending") return 5000;
      return false;
    },
  });
}

export function usePauseBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (jobId: number) =>
      api.post<BatchJobResponse>(`/api/outreach/batch/${jobId}/pause`, {}),
    onSuccess: (job) => {
      qc.setQueryData([BATCH_KEY, job.id], job);
    },
  });
}

export function useCancelBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (jobId: number) =>
      api.post<BatchJobResponse>(`/api/outreach/batch/${jobId}/cancel`, {}),
    onSuccess: (job) => {
      qc.setQueryData([BATCH_KEY, job.id], job);
      qc.invalidateQueries({ queryKey: [LEADS_KEY] });
    },
  });
}
