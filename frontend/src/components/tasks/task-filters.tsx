"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X, Tag, ChevronDown, Check, CircleOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectPopup,
  SelectItem,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useTags } from "@/hooks/use-tags";
import type { TaskFilters } from "@/types/task";

const PRIORITY_LABELS: Record<string, string> = {
  "": "All priorities",
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
};

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
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[color:var(--ink-3)] pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tasks..."
          className="pl-8 h-8 text-sm"
        />
      </div>

      {/* Priority filter */}
      <SelectRoot
        value={filters.priority ?? ""}
        onValueChange={(value) =>
          onFiltersChange({ ...filters, priority: value || undefined })
        }
        labels={PRIORITY_LABELS}
      >
        <SelectTrigger className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectPopup>
          <SelectItem value="">All priorities</SelectItem>
          <SelectItem value="urgent">Urgent</SelectItem>
          <SelectItem value="high">High</SelectItem>
          <SelectItem value="medium">Medium</SelectItem>
          <SelectItem value="low">Low</SelectItem>
        </SelectPopup>
      </SelectRoot>

      {/* Tag filter — multi-select */}
      {tags.length > 0 && (
        <div ref={tagDropdownRef} className="relative">
          <button
            type="button"
            onClick={() => setTagDropdownOpen(!tagDropdownOpen)}
            className={`flex items-center gap-1.5 border-[1.5px] px-2.5 h-8 text-[11px] uppercase tracking-[1.5px] font-mono transition-colors cursor-pointer ${
              isTagFilterActive
                ? "border-[color:var(--accent)] bg-[color:var(--bg-2)] text-[color:var(--ink)]"
                : "border-[color:var(--line)] bg-[color:var(--bg-2)] text-[color:var(--ink-3)] hover:text-[color:var(--ink)] hover:border-[color:var(--line-2)]"
            }`}
          >
            <Tag className="h-3.5 w-3.5" />
            <span>Tags</span>
            {isTagFilterActive && (
              <span className="flex h-4 min-w-4 items-center justify-center bg-[color:var(--accent)] text-[10px] text-[color:var(--bg)] px-1 font-bold">
                {selectedCount}
              </span>
            )}
            <ChevronDown
              className={`h-3 w-3 transition-transform ${tagDropdownOpen ? "rotate-180" : ""}`}
            />
          </button>

          {tagDropdownOpen && (
            <div className="absolute left-0 top-full z-50 mt-1 min-w-44 overflow-hidden border-[1.5px] border-[color:var(--line)] bg-[color:var(--bg-2)] shadow-md">
              {/* All tags toggle */}
              <button
                type="button"
                onClick={handleToggleAll}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-[color:var(--bg)] cursor-pointer ${
                  allSelected ? "text-[color:var(--ink)]" : "text-[color:var(--ink-2)]"
                }`}
              >
                <span className="flex-1 text-left">All tags</span>
                {allSelected && <Check className="h-3.5 w-3.5 text-[color:var(--accent)]" />}
              </button>

              <div className="border-t border-[color:var(--line)]" />

              {/* Individual tags */}
              {tags.map((tag) => {
                const selected = isTagSelected(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => handleToggleTag(tag.id)}
                    className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-[color:var(--bg)] cursor-pointer ${
                      selected ? "text-[color:var(--ink)]" : "text-[color:var(--ink-2)]"
                    }`}
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="flex-1 text-left">{tag.name}</span>
                    {selected && <Check className="h-3.5 w-3.5 text-[color:var(--accent)]" />}
                  </button>
                );
              })}

              <div className="border-t border-[color:var(--line)]" />

              {/* No tag (untagged) */}
              <button
                type="button"
                onClick={handleToggleUntagged}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-[color:var(--bg)] cursor-pointer ${
                  isUntaggedSelected ? "text-[color:var(--ink)]" : "text-[color:var(--ink-2)]"
                }`}
              >
                <CircleOff className="h-2.5 w-2.5 shrink-0 text-[color:var(--ink-3)]" />
                <span className="flex-1 text-left">No tag</span>
                {isUntaggedSelected && <Check className="h-3.5 w-3.5 text-[color:var(--accent)]" />}
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
          <span className="flex h-4 w-4 items-center justify-center bg-[color:var(--accent)] text-[10px] text-[color:var(--bg)] font-bold">
            {activeCount}
          </span>
        </Button>
      )}
    </div>
  );
}
