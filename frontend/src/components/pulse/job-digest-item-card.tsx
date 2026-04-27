"use client";

import { useState } from "react";
import {
  Briefcase,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Mail,
  MailOpen,
  MapPin,
  SkipForward,
  Square,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DigestItem, DigestItemAction } from "@/types/pulse-digest";

const ACTION_LABELS: Record<string, string> = {
  to_job: "Added to Job Hunt",
  skip: "Skipped",
};

interface JobDigestItemCardProps {
  item: DigestItem;
  selected: boolean;
  onToggle: () => void;
  onAction: (action: DigestItemAction) => void;
  isPending: boolean;
  onReadChange?: (read: boolean) => void;
  isReadPending?: boolean;
}

export function JobDigestItemCard({
  item,
  selected,
  onToggle,
  onAction,
  isPending,
  onReadChange,
  isReadPending,
}: JobDigestItemCardProps) {
  const [expanded, setExpanded] = useState(false);
  const isActioned = item.status === "actioned";
  const isSkipped = item.status === "skipped";
  const isDone = isActioned || isSkipped;
  const isLong = item.summary.length > 300;

  const company = item.metadata?.company;
  const salary = item.metadata?.salary_range;
  const location = item.metadata?.location;
  const url = item.metadata?.url;

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
      data-testid="job-digest-item-card"
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
        <div className="mb-1 flex items-center gap-2 flex-wrap">
          <h4 className="text-sm font-medium text-foreground">{item.title}</h4>
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

        <div className="mb-1.5 flex items-center gap-3 text-xs text-muted-foreground">
          {company && <span className="font-medium text-foreground/70">{company}</span>}
          {salary && <span>{salary}</span>}
          {location && (
            <span className="flex items-center gap-0.5">
              <MapPin className="h-3 w-3" />
              {location}
            </span>
          )}
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-0.5 text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              Link
            </a>
          )}
        </div>

        {item.source_names && item.source_names.length > 0 && (
          <div className="mb-1.5 flex items-center gap-1">
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

        <div>
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
            onClick={() => onAction("to_job")}
            disabled={isPending}
            title="Add to Job Hunt"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-surface-hover hover:text-foreground cursor-pointer"
          >
            <Briefcase className="h-3.5 w-3.5" />
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
