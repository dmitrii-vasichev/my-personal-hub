"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Job } from "@/types/job";
import type { SearchRequest, SearchResult } from "@/types/search";
import { JOBS_KEY } from "./use-jobs";

export function useJobSearch() {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [lastRequest, setLastRequest] = useState<SearchRequest | null>(null);

  const search = async (req: SearchRequest) => {
    setIsSearching(true);
    setError(null);
    setPage(1);
    setLastRequest(req);
    const limit = req.limit || 10;
    try {
      const data = await api.post<SearchResult[]>("/api/search/", { ...req, page: 1 });
      setResults(data);
      setHasMore(data.length === limit);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const loadMore = async () => {
    if (!lastRequest || isSearching) return;
    const nextPage = page + 1;
    const limit = lastRequest.limit || 10;
    setIsSearching(true);
    try {
      const data = await api.post<SearchResult[]>("/api/search/", { ...lastRequest, page: nextPage });
      setResults((prev) => [...prev, ...data]);
      setPage(nextPage);
      setHasMore(data.length === limit);
    } catch {
      // silent
    } finally {
      setIsSearching(false);
    }
  };

  const autoSearch = async (limit: number = 30) => {
    setIsSearching(true);
    setError(null);
    setPage(1);
    setLastRequest(null);
    try {
      const data = await api.post<SearchResult[]>("/api/search/auto", { page: 1, limit });
      setResults(data);
      setHasMore(data.length >= limit);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Auto-search failed");
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  return { results, isSearching, error, hasMore, search, loadMore, autoSearch };
}

export function useSaveSearchResult() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (result: SearchResult) =>
      api.post<Job>("/api/search/save", result),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [JOBS_KEY] });
    },
  });
}
