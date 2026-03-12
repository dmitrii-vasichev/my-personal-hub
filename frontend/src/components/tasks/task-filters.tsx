"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X, Tag, ChevronDown, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useTags } from "@/hooks/use-tags";
import type { TaskFilters } from "@/types/task";

interface TaskFiltersBarProps {
  filters: TaskFilters;
  onFiltersChange: (filters: TaskFilters) => void;
  extraButtons?: React.ReactNode;
}

export function TaskFiltersBar({ filters, onFiltersChange, extraButtons }: TaskFiltersBarProps) {
  const [search, setSearch] = useState(filters.search ?? "");
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const tagDropdownRef = useRef<HTMLDivElement>(null);
  const { data: tags = [] } = useTags();

  useEffect(() => {
    if (!tagDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(e.target as Node)) {
        setTagDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [tagDropdownOpen]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      onFiltersChange({ ...filters, search: search || undefined });
    }, 300);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const selectedTag = tags.find((t) => t.id === filters.tag_id);

  const activeCount = [
    filters.search,
    filters.priority,
    filters.tag_id,
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
        <option value="medium">🔵 Medium</option>
        <option value="low">⚪ Low</option>
      </Select>

      {/* Tag filter */}
      {tags.length > 0 && (
        <div ref={tagDropdownRef} className="relative">
          <button
            type="button"
            onClick={() => setTagDropdownOpen(!tagDropdownOpen)}
            className={`flex items-center gap-1.5 rounded-md border px-2.5 h-8 text-sm transition-colors cursor-pointer ${
              filters.tag_id
                ? "border-[var(--accent)] bg-[var(--accent-muted)] text-[var(--text-primary)]"
                : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]"
            }`}
          >
            {selectedTag ? (
              <>
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: selectedTag.color }}
                />
                <span className="max-w-20 truncate">{selectedTag.name}</span>
              </>
            ) : (
              <>
                <Tag className="h-3.5 w-3.5" />
                <span>Tags</span>
              </>
            )}
            <ChevronDown className={`h-3 w-3 transition-transform ${tagDropdownOpen ? "rotate-180" : ""}`} />
          </button>

          {tagDropdownOpen && (
            <div className="absolute left-0 top-full z-50 mt-1 min-w-40 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--popover)] shadow-md">
              <button
                type="button"
                onClick={() => {
                  onFiltersChange({ ...filters, tag_id: undefined });
                  setTagDropdownOpen(false);
                }}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-[var(--surface-hover)] ${
                  !filters.tag_id ? "bg-[var(--surface-hover)] text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
                }`}
              >
                <span>All tags</span>
                {!filters.tag_id && <Check className="h-3.5 w-3.5 ml-auto text-[var(--accent)]" />}
              </button>
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => {
                    onFiltersChange({
                      ...filters,
                      tag_id: filters.tag_id === tag.id ? undefined : tag.id,
                    });
                    setTagDropdownOpen(false);
                  }}
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-[var(--surface-hover)] ${
                    filters.tag_id === tag.id ? "bg-[var(--surface-hover)] text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
                  }`}
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="flex-1 text-left">{tag.name}</span>
                  {filters.tag_id === tag.id && <Check className="h-3.5 w-3.5 text-[var(--accent)]" />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Extra buttons (e.g. Columns) */}
      {extraButtons}

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
