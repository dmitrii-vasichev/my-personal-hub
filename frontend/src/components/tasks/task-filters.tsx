"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { TaskFilters } from "@/types/task";

interface TaskFiltersBarProps {
  filters: TaskFilters;
  onFiltersChange: (filters: TaskFilters) => void;
}

export function TaskFiltersBar({ filters, onFiltersChange }: TaskFiltersBarProps) {
  const [search, setSearch] = useState(filters.search ?? "");

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      onFiltersChange({ ...filters, search: search || undefined });
    }, 300);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const activeCount = [
    filters.search,
    filters.priority,
    filters.deadline_before,
    filters.deadline_after,
  ].filter(Boolean).length;

  const clearAll = () => {
    setSearch("");
    onFiltersChange({});
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Search */}
      <div className="relative flex-1 min-w-48 max-w-72">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-tertiary)] pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tasks…"
          className="pl-8 h-8 text-sm"
        />
      </div>

      {/* Priority filter */}
      <Select
        value={filters.priority ?? ""}
        onChange={(e) =>
          onFiltersChange({ ...filters, priority: e.target.value || undefined })
        }
        className="w-32 h-8 text-sm"
      >
        <option value="">All priorities</option>
        <option value="urgent">🔴 Urgent</option>
        <option value="high">🟠 High</option>
        <option value="medium">🟡 Medium</option>
        <option value="low">⚪ Low</option>
      </Select>

      {/* Deadline before */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-[var(--text-tertiary)]">Due before</span>
        <Input
          type="date"
          value={filters.deadline_before ?? ""}
          onChange={(e) =>
            onFiltersChange({ ...filters, deadline_before: e.target.value || undefined })
          }
          className="h-8 w-36 text-sm"
        />
      </div>

      {/* Clear all */}
      {activeCount > 0 && (
        <Button variant="ghost" size="sm" onClick={clearAll} className="gap-1 h-8">
          <X className="h-3.5 w-3.5" />
          Clear
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--accent)] text-[10px] text-white">
            {activeCount}
          </span>
        </Button>
      )}
    </div>
  );
}
