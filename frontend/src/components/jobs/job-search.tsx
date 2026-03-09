"use client";

import { useState } from "react";
import { Search, Sparkles, Bookmark, ExternalLink, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useJobSearch, useSaveSearchResult } from "@/hooks/use-search";
import type { SearchProvider, SearchResult } from "@/types/search";

const PROVIDERS: { value: SearchProvider; label: string }[] = [
  { value: "adzuna", label: "Adzuna" },
  { value: "serpapi", label: "SerpAPI (Google Jobs)" },
  { value: "jsearch", label: "JSearch (RapidAPI)" },
];

function formatSalary(min: number | null, max: number | null, currency: string): string | null {
  if (!min && !max) return null;
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `From ${fmt(min)}`;
  return `Up to ${fmt(max!)}`;
}

function SearchResultCard({
  result,
  saved,
  onSave,
}: {
  result: SearchResult;
  saved: boolean;
  onSave: (r: SearchResult) => void;
}) {
  const salary = formatSalary(result.salary_min, result.salary_max, result.salary_currency);

  return (
    <div className="rounded-lg border border-border bg-surface p-4 space-y-2 hover:border-border-strong transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium text-foreground truncate">{result.title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {result.company}
            {result.location && <span> · {result.location}</span>}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="rounded px-1.5 py-0.5 text-[10px] font-medium border border-border text-muted-foreground uppercase tracking-wide">
            {result.source}
          </span>
          {result.url && (
            <a
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>

      {salary && (
        <p className="text-xs text-[var(--success)]">{salary}</p>
      )}

      {result.description && (
        <p className="text-xs text-muted-foreground line-clamp-2">{result.description}</p>
      )}

      <div className="flex justify-end">
        <Button
          size="sm"
          variant={saved ? "ghost" : "secondary"}
          disabled={saved}
          onClick={() => onSave(result)}
          className="h-7 text-xs gap-1"
        >
          <Bookmark className="h-3 w-3" />
          {saved ? "Saved" : "Save Job"}
        </Button>
      </div>
    </div>
  );
}

export function JobSearch() {
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [provider, setProvider] = useState<SearchProvider>("adzuna");
  const [savedUrls, setSavedUrls] = useState<Set<string>>(new Set());

  const { results, isSearching, error, hasMore, search, loadMore, autoSearch } = useJobSearch();
  const saveResult = useSaveSearchResult();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    search({ query: query.trim(), location: location.trim() || undefined, provider });
  };

  const handleAutoSearch = () => {
    autoSearch();
  };

  const handleSave = async (result: SearchResult) => {
    try {
      await saveResult.mutateAsync(result);
      setSavedUrls((prev) => new Set(prev).add(result.url ?? result.title));
      toast.success("Job saved to your list");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save job");
    }
  };

  return (
    <div className="space-y-4">
      {/* Search form */}
      <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Job title, keywords…"
          className="flex-1 text-sm"
        />
        <Input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Location (optional)"
          className="sm:w-44 text-sm"
        />
        <Select
          value={provider}
          onChange={(e) => setProvider((e.target as HTMLSelectElement).value as SearchProvider)}
          className="sm:w-44 text-sm"
        >
          {PROVIDERS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </Select>
        <Button type="submit" disabled={isSearching || !query.trim()} className="gap-1.5">
          <Search className="h-3.5 w-3.5" />
          {isSearching ? "Searching…" : "Search"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={handleAutoSearch}
          disabled={isSearching}
          className="gap-1.5"
          title="Search using saved target roles from Settings"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Auto
        </Button>
      </form>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
          {error}
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {results.length} result{results.length !== 1 ? "s" : ""}
          </p>
          {results.map((r, idx) => (
            <SearchResultCard
              key={`${r.url ?? r.title}-${idx}`}
              result={r}
              saved={savedUrls.has(r.url ?? r.title)}
              onSave={handleSave}
            />
          ))}
          {hasMore && (
            <div className="flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={loadMore}
                disabled={isSearching}
                className="gap-1 text-xs"
              >
                <ChevronDown className="h-3.5 w-3.5" />
                Load more
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!isSearching && results.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Search className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">
            Search for jobs across external job boards
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Configure API keys in Settings to enable providers
          </p>
        </div>
      )}
    </div>
  );
}
