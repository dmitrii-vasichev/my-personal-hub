"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  KBDocument,
  KBDocumentCreateInput,
  KBDocumentUpdateInput,
} from "@/types/knowledge-base";

export const KB_KEY = "knowledge-base";

export function useKBDocuments() {
  return useQuery<KBDocument[]>({
    queryKey: [KB_KEY],
    queryFn: () => api.get<KBDocument[]>("/api/knowledge-base/"),
  });
}

export function useKBDocument(slug: string) {
  return useQuery<KBDocument>({
    queryKey: [KB_KEY, slug],
    queryFn: () => api.get<KBDocument>(`/api/knowledge-base/${slug}`),
    enabled: !!slug,
  });
}

export function useCreateKBDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: KBDocumentCreateInput) =>
      api.post<KBDocument>("/api/knowledge-base/", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KB_KEY] });
    },
  });
}

export function useUpdateKBDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ slug, data }: { slug: string; data: KBDocumentUpdateInput }) =>
      api.put<KBDocument>(`/api/knowledge-base/${slug}`, data),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: [KB_KEY] });
      qc.setQueryData([KB_KEY, updated.slug], updated);
    },
  });
}

export function useDeleteKBDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slug: string) => api.delete(`/api/knowledge-base/${slug}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KB_KEY] });
    },
  });
}

export function useResetKBDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slug: string) =>
      api.post<KBDocument>(`/api/knowledge-base/${slug}/reset`),
    onSuccess: (reset) => {
      qc.invalidateQueries({ queryKey: [KB_KEY] });
      qc.setQueryData([KB_KEY, reset.slug], reset);
    },
  });
}
