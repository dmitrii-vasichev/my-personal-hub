"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  ChangeLeadStatusInput,
  CreateLeadInput,
  CreateIndustryInput,
  GenerateProposalInput,
  Industry,
  Lead,
  LeadFilters,
  LeadKanbanCard,
  LeadKanbanData,
  LeadStatusHistoryEntry,
  PdfParseResponse,
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
