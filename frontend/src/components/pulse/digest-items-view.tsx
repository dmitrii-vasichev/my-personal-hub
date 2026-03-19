"use client";

import { useState } from "react";
import {
  Briefcase,
  CheckCheck,
  CheckSquare,
  FileText,
  Loader2,
  SkipForward,
  Square,
  Inbox,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useDigestItems,
  useDigestItemAction,
  useBulkDigestItemAction,
} from "@/hooks/use-pulse-digest-items";
import { DigestItemCard, CLASSIFICATION_STYLES } from "@/components/pulse/digest-item-card";
import { JobDigestItemCard } from "@/components/pulse/job-digest-item-card";
import type { DigestItemAction } from "@/types/pulse-digest";

interface DigestItemsViewProps {
  digestId: number;
  category: string;
}

export function DigestItemsView({ digestId, category }: DigestItemsViewProps) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [classificationFilter, setClassificationFilter] = useState<string | undefined>();

  const { data, isLoading } = useDigestItems(digestId, {
    classification: classificationFilter,
  });
  const itemAction = useDigestItemAction();
  const bulkAction = useBulkDigestItemAction();

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const newCount = items.filter((i) => i.status === "new").length;
  const actionedCount = items.filter((i) => i.status !== "new").length;
  const selectableItems = items.filter((i) => i.status === "new");
  const allSelected = selectableItems.length > 0 && selected.size === selectableItems.length;
  const isJobs = category === "jobs";

  const toggleItem = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(selectableItems.map((i) => i.id)));
    }
  };

  const handleAction = (itemId: number, action: DigestItemAction) => {
    itemAction.mutate(
      { itemId, action },
      {
        onSuccess: () =>
          setSelected((prev) => {
            const n = new Set(prev);
            n.delete(itemId);
            return n;
          }),
      }
    );
  };

  const handleBulkAction = (action: DigestItemAction) => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    bulkAction.mutate(
      { itemIds: ids, action },
      { onSuccess: () => setSelected(new Set()) }
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20" data-testid="digest-items-loading">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3 py-20 text-center"
        data-testid="digest-items-empty"
      >
        <Inbox className="h-10 w-10 text-muted-foreground opacity-40" />
        <h3 className="text-sm font-medium text-foreground">No items in this digest</h3>
        <p className="max-w-sm text-xs text-muted-foreground">
          Items will appear here when a structured digest is generated.
        </p>
      </div>
    );
  }

  return (
    <div data-testid="digest-items-view">
      {/* Toolbar */}
      <div className="mb-3 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleAll}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
          >
            {allSelected ? (
              <CheckCheck className="h-3.5 w-3.5" />
            ) : (
              <Square className="h-3.5 w-3.5" />
            )}
            {allSelected ? "Deselect all" : "Select all"}
          </button>
          <span className="text-xs text-muted-foreground">
            {total} item{total !== 1 ? "s" : ""}
            {actionedCount > 0 && (
              <> · {newCount} new · {actionedCount} processed</>
            )}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Classification filter (learning only) */}
          {!isJobs && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setClassificationFilter(undefined)}
                className={cn(
                  "rounded-md px-2 py-0.5 text-[11px] cursor-pointer transition-colors",
                  !classificationFilter
                    ? "bg-primary/15 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                All
              </button>
              {Object.entries(CLASSIFICATION_STYLES).map(([key, { label }]) => (
                <button
                  key={key}
                  onClick={() =>
                    setClassificationFilter(classificationFilter === key ? undefined : key)
                  }
                  className={cn(
                    "rounded-md px-2 py-0.5 text-[11px] cursor-pointer transition-colors",
                    classificationFilter === key
                      ? "bg-primary/15 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* Bulk actions */}
          {selected.size > 0 && (
            <div className="flex items-center gap-1">
              <span className="mr-1 text-xs text-muted-foreground">
                {selected.size} selected
              </span>
              {!isJobs && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleBulkAction("to_task")}
                    disabled={bulkAction.isPending}
                    className="h-7 text-xs"
                  >
                    <CheckSquare className="mr-1 h-3 w-3" />
                    Tasks
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleBulkAction("to_note")}
                    disabled={bulkAction.isPending}
                    className="h-7 text-xs"
                  >
                    <FileText className="mr-1 h-3 w-3" />
                    Notes
                  </Button>
                </>
              )}
              {isJobs && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkAction("to_job")}
                  disabled={bulkAction.isPending}
                  className="h-7 text-xs"
                >
                  <Briefcase className="mr-1 h-3 w-3" />
                  Job Hunt
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleBulkAction("skip")}
                disabled={bulkAction.isPending}
                className="h-7 text-xs"
              >
                <SkipForward className="mr-1 h-3 w-3" />
                Skip
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Items list */}
      <div className="flex flex-col gap-2">
        {items.map((item) =>
          isJobs ? (
            <JobDigestItemCard
              key={item.id}
              item={item}
              selected={selected.has(item.id)}
              onToggle={() => toggleItem(item.id)}
              onAction={(action) => handleAction(item.id, action)}
              isPending={itemAction.isPending}
            />
          ) : (
            <DigestItemCard
              key={item.id}
              item={item}
              selected={selected.has(item.id)}
              onToggle={() => toggleItem(item.id)}
              onAction={(action) => handleAction(item.id, action)}
              isPending={itemAction.isPending}
            />
          )
        )}
      </div>
    </div>
  );
}
