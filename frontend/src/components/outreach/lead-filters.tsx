"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useIndustries } from "@/hooks/use-leads";
import type { LeadFilters, LeadStatus } from "@/types/lead";
import { LEAD_STATUS_LABELS } from "@/types/lead";

interface LeadFiltersBarProps {
  filters: LeadFilters;
  onFiltersChange: (filters: LeadFilters) => void;
}

const STATUS_OPTIONS: LeadStatus[] = [
  "new",
  "sent",
  "replied",
  "in_progress",
  "rejected",
  "on_hold",
];

export function LeadFiltersBar({ filters, onFiltersChange }: LeadFiltersBarProps) {
  const [search, setSearch] = useState(filters.search ?? "");
  const { data: industries = [] } = useIndustries();

  useEffect(() => {
    const t = setTimeout(() => {
      onFiltersChange({ ...filters, search: search || undefined });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const activeCount = [
    filters.search,
    filters.status,
    filters.industry_id,
  ].filter(Boolean).length;

  const clearAll = () => {
    setSearch("");
    onFiltersChange({});
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="relative flex-1 min-w-48 max-w-72">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-tertiary pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search leads…"
          className="pl-8 h-8 text-sm border-border-subtle bg-surface focus-visible:border-primary"
        />
      </div>

      <Select
        value={filters.status ?? ""}
        onChange={(e) =>
          onFiltersChange({ ...filters, status: e.target.value || undefined })
        }
        className="w-40 h-8 text-sm"
      >
        <option value="">All statuses</option>
        {STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {LEAD_STATUS_LABELS[s]}
          </option>
        ))}
      </Select>

      <Select
        value={filters.industry_id?.toString() ?? ""}
        onChange={(e) =>
          onFiltersChange({
            ...filters,
            industry_id: e.target.value ? Number(e.target.value) : undefined,
          })
        }
        className="w-44 h-8 text-sm"
      >
        <option value="">All industries</option>
        {industries.map((ind) => (
          <option key={ind.id} value={ind.id}>
            {ind.name}
          </option>
        ))}
      </Select>

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
    </div>
  );
}
