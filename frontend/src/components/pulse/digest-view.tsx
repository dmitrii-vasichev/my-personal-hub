"use client";

import { RefreshCw, Clock, MessageSquare, CalendarDays } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { PulseDigest } from "@/types/pulse-digest";
import { DigestItemsView } from "@/components/pulse/digest-items-view";

interface DigestViewProps {
  digest: PulseDigest;
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

function formatShortDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function DigestView({ digest }: DigestViewProps) {
  const isStructured = digest.digest_type === "structured";

  return (
    <div data-testid="digest-view">
      {/* Metadata bar */}
      <div className="mb-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          {formatDate(digest.generated_at)}
        </span>
        <span className="flex items-center gap-1">
          <MessageSquare className="h-3.5 w-3.5" />
          {digest.items_count != null
            ? `${digest.items_count} items from ${digest.message_count} messages`
            : `${digest.message_count} messages`}
        </span>
        {(digest.period_start || digest.period_end) && (
          <span className="flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" />
            {formatShortDate(digest.period_start)} — {formatShortDate(digest.period_end)}
          </span>
        )}
      </div>

      {isStructured && digest.category ? (
        <DigestItemsView digestId={digest.id} category={digest.category} />
      ) : (
        <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:text-[var(--text-primary)] prose-p:text-[var(--text-secondary)] prose-a:text-[var(--accent)] prose-strong:text-[var(--text-primary)] prose-code:text-[var(--accent-teal)] prose-li:text-[var(--text-secondary)] prose-blockquote:border-[var(--accent)] prose-blockquote:text-[var(--text-secondary)]">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {digest.content}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}

export function DigestViewSkeleton() {
  return (
    <div className="flex items-center justify-center py-20" data-testid="digest-loading">
      <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
}

export function DigestEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center" data-testid="digest-empty">
      <MessageSquare className="h-10 w-10 text-muted-foreground opacity-40" />
      <h3 className="text-sm font-medium text-foreground">No digests yet</h3>
      <p className="max-w-sm text-xs text-muted-foreground">
        Click &quot;Generate Now&quot; to create your first digest from collected messages,
        or wait for the next scheduled generation.
      </p>
    </div>
  );
}
