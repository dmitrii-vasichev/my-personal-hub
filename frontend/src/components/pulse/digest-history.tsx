"use client";

import { useState } from "react";
import { ChevronDown, Clock, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDigests } from "@/hooks/use-pulse-digests";
import { DigestView, DigestViewSkeleton } from "./digest-view";
import { CATEGORY_LABELS } from "@/types/pulse-source";
import type { PulseDigest } from "@/types/pulse-digest";

const PAGE_SIZE = 10;

interface DigestHistoryProps {
  category: string | null;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DigestHistory({ category }: DigestHistoryProps) {
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data, isLoading } = useDigests(
    limit,
    0,
    category ?? undefined
  );

  if (isLoading) return <DigestViewSkeleton />;

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-center" data-testid="history-empty">
        <Clock className="h-8 w-8 text-muted-foreground opacity-40" />
        <p className="text-sm text-muted-foreground">No digest history</p>
      </div>
    );
  }

  return (
    <div className="space-y-2" data-testid="digest-history">
      {items.map((digest) => (
        <DigestHistoryItem
          key={digest.id}
          digest={digest}
          expanded={expandedId === digest.id}
          onToggle={() =>
            setExpandedId(expandedId === digest.id ? null : digest.id)
          }
        />
      ))}

      {items.length < total && (
        <div className="flex justify-center pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLimit((prev) => prev + PAGE_SIZE)}
          >
            <ChevronDown className="mr-1.5 h-4 w-4" />
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}

function DigestHistoryItem({
  digest,
  expanded,
  onToggle,
}: {
  digest: PulseDigest;
  expanded: boolean;
  onToggle: () => void;
}) {
  const categoryLabel = digest.category
    ? CATEGORY_LABELS[digest.category] ?? digest.category
    : "All";

  return (
    <div className="rounded-lg border border-border bg-surface">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left cursor-pointer hover:bg-surface-hover transition-colors rounded-lg"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-foreground">
            {formatDate(digest.generated_at)}
          </span>
          <span className="rounded bg-surface-hover px-2 py-0.5 text-xs text-muted-foreground">
            {categoryLabel}
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <MessageSquare className="h-3 w-3" />
            {digest.items_count != null
              ? `${digest.items_count} items`
              : digest.message_count}
          </span>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>

      {expanded && (
        <div className="border-t border-border px-4 py-4">
          <DigestView digest={digest} />
        </div>
      )}
    </div>
  );
}
