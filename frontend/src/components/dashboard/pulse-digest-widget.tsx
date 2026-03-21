"use client";

import { Radio, Newspaper, Briefcase, GraduationCap } from "lucide-react";
import Link from "next/link";
import { useDashboardPulse } from "@/hooks/use-dashboard-pulse";
import type { DigestSummaryItem } from "@/types/pulse-digest";

const CATEGORY_CONFIG: Record<
  string,
  { label: string; icon: React.ReactNode; color: string; bg: string }
> = {
  news: {
    label: "News",
    icon: <Newspaper size={14} />,
    color: "var(--accent-violet)",
    bg: "var(--accent-violet-muted)",
  },
  jobs: {
    label: "Jobs",
    icon: <Briefcase size={14} />,
    color: "var(--accent-amber)",
    bg: "var(--accent-amber-muted)",
  },
  learning: {
    label: "Learning",
    icon: <GraduationCap size={14} />,
    color: "var(--accent-teal)",
    bg: "var(--accent-teal-muted)",
  },
};

function formatPeriod(start: string | null, end: string | null): string {
  if (!start || !end) return "";
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const startStr = s.toLocaleDateString("en-US", opts);
  const endStr = e.toLocaleDateString("en-US", opts);
  if (startStr === endStr) return startStr;
  return `${startStr} – ${endStr}`;
}

const MAX_VISIBLE_ITEMS = 3;

function CategoryRow({ digest }: { digest: DigestSummaryItem }) {
  const config = CATEGORY_CONFIG[digest.category ?? ""] ?? CATEGORY_CONFIG.news;
  const totalCount = digest.items_count ?? digest.message_count;
  const allItems = digest.preview_items ?? [];
  const visibleItems = allItems.slice(0, MAX_VISIBLE_ITEMS);
  const hasPreviewItems = visibleItems.length > 0;
  const moreCount = totalCount - visibleItems.length;

  return (
    <Link href={`/pulse?digest=${digest.id}`} className="block">
      <div className="px-4 py-3 transition-colors hover:bg-surface-hover">
        <div className="flex items-center gap-2 mb-1.5">
          <span
            className="flex h-5 w-5 items-center justify-center rounded"
            style={{ color: config.color, background: config.bg }}
          >
            {config.icon}
          </span>
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {config.label}
          </span>
          <span className="ml-auto text-[11px] text-tertiary">
            {digest.items_count != null
              ? `${digest.items_count} items`
              : `${digest.message_count} messages`}
          </span>
        </div>
        {hasPreviewItems ? (
          <div className="flex flex-wrap items-center gap-2">
            {visibleItems.map((item, i) => (
              <span
                key={i}
                className="inline-flex max-w-[280px] items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm text-foreground"
                style={{ background: config.bg }}
              >
                <span className="truncate">{item.title}</span>
                {item.classification && (
                  <span
                    className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium"
                    style={{ color: config.color }}
                  >
                    {item.classification}
                  </span>
                )}
              </span>
            ))}
            {moreCount > 0 && (
              <span className="text-[11px] text-tertiary">
                + {moreCount} more
              </span>
            )}
          </div>
        ) : (
          <p className="text-sm text-foreground line-clamp-2 leading-relaxed">
            {digest.content_preview
              ? digest.content_preview
              : digest.items_count
                ? `${digest.items_count} new items to review`
                : "No content available"}
          </p>
        )}
      </div>
    </Link>
  );
}

function WidgetSkeleton() {
  return (
    <div className="rounded-xl border border-border-subtle bg-card">
      <div className="border-b border-border-subtle px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded bg-muted animate-pulse" />
          <div className="h-4 w-12 rounded bg-muted animate-pulse" />
        </div>
      </div>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className={`px-4 py-3 ${i < 3 ? "border-b border-border-subtle" : ""}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="h-5 w-5 rounded bg-muted animate-pulse" />
            <div className="h-3 w-14 rounded bg-muted animate-pulse" />
          </div>
          <div className="h-4 w-full rounded bg-muted animate-pulse mb-1" />
          <div className="h-4 w-2/3 rounded bg-muted animate-pulse" />
        </div>
      ))}
    </div>
  );
}

export function PulseDigestWidget() {
  const { data: summary, isLoading } = useDashboardPulse();

  if (isLoading) {
    return <WidgetSkeleton />;
  }

  const digests = summary?.digests ?? [];
  const period = formatPeriod(
    summary?.period_start ?? null,
    summary?.period_end ?? null
  );

  return (
    <div className="rounded-xl border border-border-subtle bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            className="flex h-[28px] w-[28px] items-center justify-center rounded-lg"
            style={{
              color: "var(--accent-violet)",
              background: "var(--accent-violet-muted)",
            }}
          >
            <Radio size={14} />
          </span>
          <span className="text-sm font-medium text-foreground">Pulse</span>
          {period && (
            <span className="text-[11px] text-tertiary">· {period}</span>
          )}
        </div>
        <Link
          href="/pulse"
          className="text-[12px] text-tertiary hover:text-muted-foreground transition-colors"
        >
          View all &rarr;
        </Link>
      </div>

      {/* Category rows */}
      {digests.length > 0 ? (
        <div>
          {digests.map((digest, idx) => (
            <div
              key={digest.id}
              className={
                idx < digests.length - 1
                  ? "border-b border-border-subtle"
                  : ""
              }
            >
              <CategoryRow digest={digest} />
            </div>
          ))}
        </div>
      ) : (
        <div className="px-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            No digests yet — configure sources to get started
          </p>
        </div>
      )}
    </div>
  );
}
