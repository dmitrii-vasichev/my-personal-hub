"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectPopup,
  SelectItem,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { JobFilters } from "@/types/job";
import { APPLICATION_STATUS_LABELS } from "@/types/job";
import type { ApplicationStatus } from "@/types/job";

const KNOWN_SOURCES = ["LinkedIn", "Indeed", "Glassdoor", "Greenhouse", "Lever", "Other"];

const STATUS_OPTIONS: ApplicationStatus[] = [
  "found",
  "saved",
  "resume_generated",
  "applied",
  "screening",
  "technical_interview",
  "final_interview",
  "offer",
  "accepted",
  "rejected",
  "ghosted",
  "withdrawn",
];

const SOURCE_LABELS: Record<string, string> = {
  "": "All sources",
  ...Object.fromEntries(KNOWN_SOURCES.map((s) => [s, s])),
};

const STATUS_LABELS_MAP: Record<string, string> = {
  "": "All statuses",
  ...Object.fromEntries(STATUS_OPTIONS.map((s) => [s, APPLICATION_STATUS_LABELS[s]])),
};

/* ── Search input with debounce ── */

interface JobSearchInputProps {
  value?: string;
  onChange: (search: string | undefined) => void;
}

export function JobSearchInput({ value, onChange }: JobSearchInputProps) {
  const [search, setSearch] = useState(value ?? "");

  useEffect(() => {
    const t = setTimeout(() => {
      onChange(search || undefined);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div className="relative flex-1 min-w-0">
      <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-tertiary pointer-events-none" />
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search jobs…"
        className="pl-8 h-8 text-sm border-border-subtle bg-surface focus-visible:border-primary"
      />
    </div>
  );
}

/* ── Source / Status dropdowns + Clear button ── */

interface JobFilterDropdownsProps {
  filters: JobFilters;
  onFiltersChange: (filters: JobFilters) => void;
}

export function JobFilterDropdowns({ filters, onFiltersChange }: JobFilterDropdownsProps) {
  const activeCount = [filters.source, filters.status].filter(Boolean).length;

  const clearAll = () => {
    onFiltersChange({ ...filters, source: undefined, status: undefined });
  };

  return (
    <>
      {/* Source filter */}
      <SelectRoot
        value={filters.source ?? ""}
        onValueChange={(value) =>
          onFiltersChange({ ...filters, source: value || undefined })
        }
        labels={SOURCE_LABELS}
      >
        <SelectTrigger className="w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectPopup>
          <SelectItem value="">All sources</SelectItem>
          {KNOWN_SOURCES.map((s) => (
            <SelectItem key={s} value={s}>
              {s}
            </SelectItem>
          ))}
        </SelectPopup>
      </SelectRoot>

      {/* Status filter */}
      <SelectRoot
        value={filters.status ?? ""}
        onValueChange={(value) =>
          onFiltersChange({ ...filters, status: value || undefined })
        }
        labels={STATUS_LABELS_MAP}
      >
        <SelectTrigger className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectPopup>
          <SelectItem value="">All statuses</SelectItem>
          {STATUS_OPTIONS.map((s) => (
            <SelectItem key={s} value={s}>
              {APPLICATION_STATUS_LABELS[s]}
            </SelectItem>
          ))}
        </SelectPopup>
      </SelectRoot>

      {/* Clear all */}
      {activeCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearAll}
          className="gap-1 h-8 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
          Clear
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
            {activeCount}
          </span>
        </Button>
      )}
    </>
  );
}
