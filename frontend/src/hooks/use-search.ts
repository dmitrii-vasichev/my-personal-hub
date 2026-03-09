"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
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
    try {
      const data = await api.post<SearchResult[]>("/api/search/", { ...req, page: 1 });
      setResults(data);
      setHasMore(data.length === 10);
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
    setIsSearching(true);
    try {
      const data = await api.post<SearchResult[]>("/api/search/", { ...lastRequest, page: nextPage });
      setResults((prev) => [...prev, ...data]);
      setPage(nextPage);
      setHasMore(data.length === 10);
    } catch {
      // silent
    } finally {
      setIsSearching(false);
    }
  };

  const autoSearch = async () => {
    setIsSearching(true);
    setError(null);
    setPage(1);
    setLastRequest(null);
    try {
      const data = await api.post<SearchResult[]>("/api/search/auto", { page: 1 });
      setResults(data);
      setHasMore(data.length >= 10);
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
      api.post("/api/search/save", result),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [JOBS_KEY] });
    },
  });
}
