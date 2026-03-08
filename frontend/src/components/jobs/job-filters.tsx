"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { JobFilters } from "@/types/job";

interface JobFiltersBarProps {
  filters: JobFilters;
  onFiltersChange: (filters: JobFilters) => void;
}

const KNOWN_SOURCES = ["LinkedIn", "Indeed", "Glassdoor", "Greenhouse", "Lever", "Other"];

export function JobFiltersBar({ filters, onFiltersChange }: JobFiltersBarProps) {
  const [search, setSearch] = useState(filters.search ?? "");

  // Debounce search — 300ms delay before updating parent
  useEffect(() => {
    const t = setTimeout(() => {
      onFiltersChange({ ...filters, search: search || undefined });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const activeCount = [
    filters.search,
    filters.source,
    filters.has_application !== undefined ? String(filters.has_application) : undefined,
  ].filter(Boolean).length;

  const clearAll = () => {
    setSearch("");
    onFiltersChange({});
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Search input */}
      <div className="relative flex-1 min-w-48 max-w-72">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#5C5C66] pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search jobs…"
          className="pl-8 h-8 text-sm border-[#232329] bg-[#0A0A0B] focus-visible:border-[#5B6AD0]"
        />
      </div>

      {/* Source filter */}
      <Select
        value={filters.source ?? ""}
        onChange={(e) =>
          onFiltersChange({ ...filters, source: e.target.value || undefined })
        }
        className="w-36 h-8 text-sm"
      >
        <option value="">All sources</option>
        {KNOWN_SOURCES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </Select>

      {/* "Has application" toggle button */}
      <button
        onClick={() =>
          onFiltersChange({
            ...filters,
            has_application:
              filters.has_application === true ? undefined : true,
          })
        }
        className={`h-8 px-3 rounded-lg text-sm font-medium border transition-colors ${
          filters.has_application === true
            ? "bg-[#5B6AD0] border-[#5B6AD0] text-white"
            : "border-[#232329] text-[#8B8B93] hover:border-[#3a3a45] hover:text-[#EDEDEF]"
        }`}
      >
        Applied
      </button>

      {/* Clear all */}
      {activeCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearAll}
          className="gap-1 h-8 text-[#8B8B93] hover:text-[#EDEDEF]"
        >
          <X className="h-3.5 w-3.5" />
          Clear
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#5B6AD0] text-[10px] text-white">
            {activeCount}
          </span>
        </Button>
      )}
    </div>
  );
}
