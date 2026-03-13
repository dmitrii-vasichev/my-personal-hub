"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X, Tag, ChevronDown, Check, CircleOff } from "lucide-react";
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

  // "All selected" = no tag_ids and include_untagged is not explicitly false
  const allTagIds = tags.map((t) => t.id);
  const selectedTagIds = filters.tag_ids;
  const includeUntagged = filters.include_untagged;

  // All selected means: no filtering active (tag_ids undefined and include_untagged undefined)
  const allSelected = selectedTagIds === undefined && includeUntagged === undefined;

  const isTagSelected = (tagId: number) => {
    if (allSelected) return true;
    return selectedTagIds?.includes(tagId) ?? false;
  };

  const isUntaggedSelected = allSelected || (includeUntagged ?? false);

  // Count how many tags are deselected (for the badge)
  const totalItems = tags.length + 1; // tags + "No tag"
  const selectedCount = allSelected
    ? totalItems
    : (selectedTagIds?.length ?? 0) + (isUntaggedSelected ? 1 : 0);
  const isTagFilterActive = !allSelected;

  const handleToggleTag = (tagId: number) => {
    if (allSelected) {
      // Switch from "all" to explicit selection: deselect this one tag
      const newIds = allTagIds.filter((id) => id !== tagId);
      onFiltersChange({ ...filters, tag_ids: newIds, include_untagged: true });
    } else {
      const current = selectedTagIds ?? [];
      const isCurrentlySelected = current.includes(tagId);
      const newIds = isCurrentlySelected
        ? current.filter((id) => id !== tagId)
        : [...current, tagId];
      const newUntagged = includeUntagged ?? false;

      // If all are now selected again, clear to "all" state
      if (newIds.length === allTagIds.length && newUntagged) {
        onFiltersChange({ ...filters, tag_ids: undefined, include_untagged: undefined });
      } else {
        onFiltersChange({ ...filters, tag_ids: newIds, include_untagged: newUntagged });
      }
    }
  };

  const handleToggleUntagged = () => {
    if (allSelected) {
      // Switch from "all" to explicit: deselect untagged
      onFiltersChange({ ...filters, tag_ids: [...allTagIds], include_untagged: false });
    } else {
      const newUntagged = !isUntaggedSelected;
      const currentIds = selectedTagIds ?? [];

      // If all tags + untagged are now selected, clear to "all" state
      if (currentIds.length === allTagIds.length && newUntagged) {
        onFiltersChange({ ...filters, tag_ids: undefined, include_untagged: undefined });
      } else {
        onFiltersChange({ ...filters, tag_ids: currentIds, include_untagged: newUntagged });
      }
    }
  };

  const handleToggleAll = () => {
    if (allSelected) {
      // Deselect all
      onFiltersChange({ ...filters, tag_ids: [], include_untagged: false });
    } else {
      // Select all
      onFiltersChange({ ...filters, tag_ids: undefined, include_untagged: undefined });
    }
  };

  const activeCount = [
    filters.search,
    filters.priority,
    isTagFilterActive,
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
          placeholder="Search tasks..."
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
        <option value="urgent">Urgent</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </Select>

      {/* Tag filter — multi-select */}
      {tags.length > 0 && (
        <div ref={tagDropdownRef} className="relative">
          <button
            type="button"
            onClick={() => setTagDropdownOpen(!tagDropdownOpen)}
            className={`flex items-center gap-1.5 rounded-md border px-2.5 h-8 text-sm transition-colors cursor-pointer ${
              isTagFilterActive
                ? "border-[var(--accent)] bg-[var(--accent-muted)] text-[var(--text-primary)]"
                : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]"
            }`}
          >
            <Tag className="h-3.5 w-3.5" />
            <span>Tags</span>
            {isTagFilterActive && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent)] text-[10px] text-white px-1">
                {selectedCount}
              </span>
            )}
            <ChevronDown className={`h-3 w-3 transition-transform ${tagDropdownOpen ? "rotate-180" : ""}`} />
          </button>

          {tagDropdownOpen && (
            <div className="absolute left-0 top-full z-50 mt-1 min-w-44 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--popover)] shadow-md">
              {/* All tags toggle */}
              <button
                type="button"
                onClick={handleToggleAll}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-[var(--surface-hover)] cursor-pointer ${
                  allSelected ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
                }`}
              >
                <span className="flex-1 text-left">All tags</span>
                {allSelected && <Check className="h-3.5 w-3.5 text-[var(--accent)]" />}
              </button>

              <div className="border-t border-[var(--border)]" />

              {/* Individual tags */}
              {tags.map((tag) => {
                const selected = isTagSelected(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => handleToggleTag(tag.id)}
                    className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-[var(--surface-hover)] cursor-pointer ${
                      selected ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
                    }`}
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="flex-1 text-left">{tag.name}</span>
                    {selected && <Check className="h-3.5 w-3.5 text-[var(--accent)]" />}
                  </button>
                );
              })}

              <div className="border-t border-[var(--border)]" />

              {/* No tag (untagged) */}
              <button
                type="button"
                onClick={handleToggleUntagged}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-[var(--surface-hover)] cursor-pointer ${
                  isUntaggedSelected ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
                }`}
              >
                <CircleOff className="h-2.5 w-2.5 shrink-0 text-[var(--text-tertiary)]" />
                <span className="flex-1 text-left">No tag</span>
                {isUntaggedSelected && <Check className="h-3.5 w-3.5 text-[var(--accent)]" />}
              </button>
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
