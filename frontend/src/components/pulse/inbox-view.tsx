"use client";

import { useState } from "react";
import {
  CheckSquare,
  FileText,
  Inbox,
  Loader2,
  SkipForward,
  Square,
  CheckCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  usePulseInbox,
  useInboxAction,
  useBulkInboxAction,
} from "@/hooks/use-pulse-inbox";
import type { InboxAction, InboxItem } from "@/types/pulse-inbox";

const CLASSIFICATION_STYLES: Record<string, { label: string; color: string }> = {
  article: { label: "Article", color: "bg-blue-500/15 text-blue-400" },
  lifehack: { label: "Lifehack", color: "bg-emerald-500/15 text-emerald-400" },
  insight: { label: "Insight", color: "bg-amber-500/15 text-amber-400" },
  tool: { label: "Tool", color: "bg-violet-500/15 text-violet-400" },
  other: { label: "Other", color: "bg-gray-500/15 text-muted-foreground" },
};

function ClassificationBadge({ type }: { type: string | null }) {
  const style = CLASSIFICATION_STYLES[type || "other"] ?? CLASSIFICATION_STYLES.other;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium",
        style.color
      )}
    >
      {style.label}
    </span>
  );
}

function RelevanceIndicator({ score }: { score: number | null }) {
  if (score === null) return null;
  const pct = Math.round(score * 100);
  return (
    <span className="text-[11px] text-muted-foreground" title={`Relevance: ${pct}%`}>
      {pct}%
    </span>
  );
}

function formatDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface InboxItemRowProps {
  item: InboxItem;
  selected: boolean;
  onToggle: () => void;
  onAction: (action: InboxAction) => void;
  isPending: boolean;
}

function InboxItemRow({
  item,
  selected,
  onToggle,
  onAction,
  isPending,
}: InboxItemRowProps) {
  const textPreview = item.text
    ? item.text.length > 200
      ? item.text.slice(0, 200) + "..."
      : item.text
    : "No content";

  return (
    <div
      className={cn(
        "group flex gap-3 rounded-lg border border-border p-3 transition-colors",
        selected ? "bg-surface-hover" : "hover:bg-surface-hover/50"
      )}
      data-testid="inbox-item"
    >
      {/* Checkbox */}
      <button
        onClick={onToggle}
        className="mt-0.5 shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
      >
        {selected ? (
          <CheckSquare className="h-4 w-4 text-primary" />
        ) : (
          <Square className="h-4 w-4" />
        )}
      </button>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <ClassificationBadge type={item.ai_classification} />
          <RelevanceIndicator score={item.ai_relevance} />
          {item.source_title && (
            <span className="truncate text-[11px] text-muted-foreground">
              {item.source_title}
            </span>
          )}
          <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
            {formatDate(item.message_date)}
          </span>
        </div>

        <p className="text-sm text-foreground/80 leading-relaxed">{textPreview}</p>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-start gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          onClick={() => onAction("to_task")}
          disabled={isPending}
          title="Save as Task"
          className="rounded-md p-1.5 text-muted-foreground hover:bg-surface-hover hover:text-foreground cursor-pointer"
        >
          <CheckSquare className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onAction("to_note")}
          disabled={isPending}
          title="Save as Note"
          className="rounded-md p-1.5 text-muted-foreground hover:bg-surface-hover hover:text-foreground cursor-pointer"
        >
          <FileText className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onAction("skip")}
          disabled={isPending}
          title="Skip"
          className="rounded-md p-1.5 text-muted-foreground hover:bg-surface-hover hover:text-foreground cursor-pointer"
        >
          <SkipForward className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function InboxView() {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const { data, isLoading } = usePulseInbox();
  const inboxAction = useInboxAction();
  const bulkAction = useBulkInboxAction();

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const allSelected = items.length > 0 && selected.size === items.length;

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
      setSelected(new Set(items.map((i) => i.id)));
    }
  };

  const handleAction = (messageId: number, action: InboxAction) => {
    inboxAction.mutate(
      { messageId, action },
      { onSuccess: () => setSelected((prev) => { const n = new Set(prev); n.delete(messageId); return n; }) }
    );
  };

  const handleBulkAction = (action: InboxAction) => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    bulkAction.mutate(
      { messageIds: ids, action },
      { onSuccess: () => setSelected(new Set()) }
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20" data-testid="inbox-loading">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center" data-testid="inbox-empty">
        <Inbox className="h-10 w-10 text-muted-foreground opacity-40" />
        <h3 className="text-sm font-medium text-foreground">Inbox is empty</h3>
        <p className="max-w-sm text-xs text-muted-foreground">
          Learning items will appear here after messages are collected and classified by AI.
        </p>
      </div>
    );
  }

  return (
    <div data-testid="inbox-view">
      {/* Toolbar */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
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
          </span>
        </div>

        {/* Bulk actions */}
        {selected.size > 0 && (
          <div className="flex items-center gap-1">
            <span className="mr-1 text-xs text-muted-foreground">
              {selected.size} selected
            </span>
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

      {/* Items list */}
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <InboxItemRow
            key={item.id}
            item={item}
            selected={selected.has(item.id)}
            onToggle={() => toggleItem(item.id)}
            onAction={(action) => handleAction(item.id, action)}
            isPending={inboxAction.isPending}
          />
        ))}
      </div>
    </div>
  );
}
