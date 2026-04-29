"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Tag, X, ChevronDown, Minus } from "lucide-react";
import { toast } from "sonner";
import { useTags, useBulkTag } from "@/hooks/use-tags";
import type { KanbanBoard } from "@/types/task";
import type { TagBrief } from "@/types/tag";

interface BulkActionToolbarProps {
  selectedTaskIds: Set<number>;
  board: KanbanBoard;
  onClearSelection: () => void;
}

// ── Tag Picker Dropdown ─────────────────────────────────────────────────────

function BulkTagPicker({
  label,
  tags,
  onSelect,
  isPending,
}: {
  label: string;
  tags: { id: number; name: string; color: string }[];
  onSelect: (tagId: number) => void;
  isPending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={isPending || tags.length === 0}
        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--surface-hover)] transition-colors disabled:opacity-50 cursor-pointer"
      >
        {label === "Add tag" ? <Tag className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
        {label}
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-1 w-48 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--popover)] shadow-lg z-50">
          <div className="max-h-48 overflow-y-auto">
            {tags.length === 0 ? (
              <div className="px-3 py-2 text-xs text-[var(--text-tertiary)]">
                No tags available
              </div>
            ) : (
              tags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => {
                    onSelect(tag.id);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-[var(--surface-hover)] cursor-pointer"
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="flex-1 text-left text-[var(--text-primary)]">
                    {tag.name}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Toolbar ────────────────────────────────────────────────────────────

export function BulkActionToolbar({
  selectedTaskIds,
  board,
  onClearSelection,
}: BulkActionToolbarProps) {
  const { data: allTags = [] } = useTags();
  const bulkTag = useBulkTag();

  // Collect tags currently present on selected tasks (for "Remove tag" picker)
  const tagsOnSelectedTasks = useMemo(() => {
    const tagMap = new Map<number, TagBrief>();
    const allTasks = [
      ...board.backlog,
      ...board.new,
      ...board.in_progress,
      ...board.review,
      ...board.done,
      ...board.cancelled,
    ];
    for (const task of allTasks) {
      if (selectedTaskIds.has(task.id) && task.tags) {
        for (const tag of task.tags) {
          tagMap.set(tag.id, tag);
        }
      }
    }
    return Array.from(tagMap.values());
  }, [selectedTaskIds, board]);

  const handleAddTag = async (tagId: number) => {
    const taskIds = Array.from(selectedTaskIds);
    try {
      const result = await bulkTag.mutateAsync({
        task_ids: taskIds,
        add_tag_ids: [tagId],
      });
      const tagName = allTags.find((t) => t.id === tagId)?.name ?? "Tag";
      toast.success(`"${tagName}" added to ${result.affected_tasks} tasks`);
      onClearSelection();
    } catch {
      toast.error("Failed to add tag");
    }
  };

  const handleRemoveTag = async (tagId: number) => {
    const taskIds = Array.from(selectedTaskIds);
    try {
      const result = await bulkTag.mutateAsync({
        task_ids: taskIds,
        remove_tag_ids: [tagId],
      });
      const tagName = allTags.find((t) => t.id === tagId)?.name ?? "Tag";
      toast.success(`"${tagName}" removed from ${result.affected_tasks} tasks`);
      onClearSelection();
    } catch {
      toast.error("Failed to remove tag");
    }
  };

  return (
    <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur-md px-5 py-3 shadow-xl">
        {/* Count */}
        <div className="flex items-center gap-2">
          <span className="flex h-5 min-w-5 items-center justify-center rounded bg-[var(--accent)] px-1.5 text-xs font-bold text-[var(--primary-foreground)]">
            {selectedTaskIds.size}
          </span>
          <span className="text-sm text-[var(--text-secondary)] whitespace-nowrap">
            {selectedTaskIds.size === 1 ? "task" : "tasks"} selected
          </span>
        </div>

        <div className="h-5 w-px bg-[var(--border)]" />

        {/* Actions */}
        <BulkTagPicker
          label="Add tag"
          tags={allTags}
          onSelect={handleAddTag}
          isPending={bulkTag.isPending}
        />
        <BulkTagPicker
          label="Remove tag"
          tags={tagsOnSelectedTasks}
          onSelect={handleRemoveTag}
          isPending={bulkTag.isPending}
        />

        <div className="h-5 w-px bg-[var(--border)]" />

        {/* Cancel */}
        <button
          type="button"
          onClick={onClearSelection}
          className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
        >
          <X className="h-3.5 w-3.5" />
          Cancel
        </button>
      </div>
    </div>
  );
}
