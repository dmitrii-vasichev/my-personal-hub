"use client";

import { useState } from "react";
import {
  CheckSquare,
  FileText,
  Mail,
  MailOpen,
  SkipForward,
  Square,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DigestItem, DigestItemAction } from "@/types/pulse-digest";

export const CLASSIFICATION_STYLES: Record<string, { label: string; color: string }> = {
  article: { label: "Article", color: "bg-blue-500/15 text-blue-400" },
  lifehack: { label: "Lifehack", color: "bg-emerald-500/15 text-emerald-400" },
  insight: { label: "Insight", color: "bg-amber-500/15 text-amber-400" },
  tool: { label: "Tool", color: "bg-violet-500/15 text-violet-400" },
  other: { label: "Other", color: "bg-gray-500/15 text-muted-foreground" },
};

function ClassificationBadge({ type }: { type: string }) {
  const style = CLASSIFICATION_STYLES[type] ?? CLASSIFICATION_STYLES.other;
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

const ACTION_LABELS: Record<string, string> = {
  to_task: "Saved",
  to_note: "Saved as note",
  to_job: "Added to Job Hunt",
  skip: "Skipped",
};

interface DigestItemCardProps {
  item: DigestItem;
  selected: boolean;
  onToggle: () => void;
  onAction: (action: DigestItemAction) => void;
  isPending: boolean;
  onReadChange?: (read: boolean) => void;
  isReadPending?: boolean;
}

export function DigestItemCard({
  item,
  selected,
  onToggle,
  onAction,
  isPending,
  onReadChange,
  isReadPending,
}: DigestItemCardProps) {
  const [expanded, setExpanded] = useState(false);
  const isActioned = item.status === "actioned";
  const isSkipped = item.status === "skipped";
  const isDone = isActioned || isSkipped;
  const summaryLines = item.summary.split("\n");
  const isLong = summaryLines.length > 3 || item.summary.length > 300;

  return (
    <div
      className={cn(
        "group flex gap-3 rounded-lg border border-border p-3 transition-colors",
        isDone
          ? "opacity-50"
          : !item.is_read
            ? "border-primary/40 bg-primary/5 hover:bg-primary/10"
            : selected
              ? "bg-surface-hover"
              : "hover:bg-surface-hover/50"
      )}
      data-testid="digest-item-card"
    >
      {/* Checkbox */}
      {!isDone && (
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
      )}

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <ClassificationBadge type={item.classification} />
          {item.source_names && item.source_names.length > 0 && (
            <div className="flex items-center gap-1">
              {item.source_names.map((name) => (
                <span
                  key={name}
                  className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                >
                  {name}
                </span>
              ))}
            </div>
          )}
          {(isDone || onReadChange) && (
            <div className="ml-auto flex items-center gap-1.5">
              {isDone && (
                <span className="text-[11px] text-muted-foreground">
                  {ACTION_LABELS[item.action_type || "skip"]}
                </span>
              )}
              {onReadChange && (
                <button
                  onClick={() => onReadChange(!item.is_read)}
                  disabled={isReadPending}
                  title={item.is_read ? "Mark unread" : "Mark read"}
                  className="rounded-md p-1 text-muted-foreground hover:bg-surface-hover hover:text-foreground disabled:opacity-60"
                >
                  {item.is_read ? (
                    <MailOpen className="h-3.5 w-3.5" />
                  ) : (
                    <Mail className="h-3.5 w-3.5" />
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        <h4 className="text-sm font-medium text-foreground">{item.title}</h4>

        <div className="mt-1">
          <p
            className={cn(
              "text-sm text-foreground/70 leading-relaxed whitespace-pre-line",
              !expanded && isLong && "line-clamp-3"
            )}
          >
            {item.summary}
          </p>
          {isLong && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-0.5 flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-3 w-3" /> Show less
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3" /> Show more
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Actions */}
      {!isDone && (
        <div className="flex shrink-0 items-start gap-1 opacity-0 transition-opacity group-hover:opacity-100">
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
      )}
    </div>
  );
}
