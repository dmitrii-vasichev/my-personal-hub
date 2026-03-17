"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles, History, Radio as RadioIcon, Inbox, Settings2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CategoryTabs } from "@/components/pulse/category-tabs";
import {
  DigestView,
  DigestViewSkeleton,
  DigestEmptyState,
} from "@/components/pulse/digest-view";
import { DigestHistory } from "@/components/pulse/digest-history";
import { InboxView } from "@/components/pulse/inbox-view";
import { useLatestDigest, useGenerateDigest } from "@/hooks/use-pulse-digests";
import { usePulseInbox } from "@/hooks/use-pulse-inbox";

type ViewMode = "latest" | "history" | "inbox";

export default function PulseDigestsPage() {
  const [category, setCategory] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("latest");

  const { data: latestDigest, isLoading } = useLatestDigest(
    category ?? undefined
  );
  const generateDigest = useGenerateDigest();
  const { data: inboxData } = usePulseInbox();
  const inboxCount = inboxData?.total ?? 0;

  const handleCategoryChange = (cat: string | null) => {
    setCategory(cat);
    // Auto-switch to inbox when Learning tab is selected
    if (cat === "learning" && viewMode !== "inbox") {
      setViewMode("inbox");
    }
    // Switch back from inbox if another tab is selected
    if (cat !== "learning" && viewMode === "inbox") {
      setViewMode("latest");
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-6 animate-[fadeIn_0.4s_ease_both]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Pulse Digests</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            AI-generated summaries from your Telegram channels
          </p>
        </div>
        <div className="flex items-center gap-2">
          {viewMode !== "inbox" && (
            <Button
              size="sm"
              onClick={() => generateDigest.mutate(category ?? undefined)}
              disabled={generateDigest.isPending}
            >
              <Sparkles className={`mr-1.5 h-4 w-4 ${generateDigest.isPending ? "animate-spin" : ""}`} />
              Generate Now
            </Button>
          )}
          <Link
            href="/pulse/prompts"
            className="inline-flex h-7 items-center gap-1 rounded-[min(var(--radius-md),12px)] border border-border bg-background px-2.5 text-[0.8rem] font-medium text-foreground transition-all hover:bg-muted dark:border-input dark:bg-input/30 dark:hover:bg-input/50"
          >
            <FileText className="h-3.5 w-3.5" />
            Prompts
          </Link>
          <Link
            href="/pulse/sources"
            className="inline-flex h-7 items-center gap-1 rounded-[min(var(--radius-md),12px)] border border-border bg-background px-2.5 text-[0.8rem] font-medium text-foreground transition-all hover:bg-muted dark:border-input dark:bg-input/30 dark:hover:bg-input/50"
          >
            <Settings2 className="h-3.5 w-3.5" />
            Sources
          </Link>
        </div>
      </div>

      {/* Tabs & view toggle */}
      <div className="flex items-center justify-between mb-4">
        <CategoryTabs active={category} onChange={handleCategoryChange} />

        <div className="flex gap-1">
          <button
            onClick={() => setViewMode("latest")}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
              viewMode === "latest"
                ? "bg-surface-hover text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <RadioIcon className="mr-1 inline h-3.5 w-3.5" />
            Latest
          </button>
          <button
            onClick={() => setViewMode("history")}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
              viewMode === "history"
                ? "bg-surface-hover text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <History className="mr-1 inline h-3.5 w-3.5" />
            History
          </button>
          <button
            onClick={() => {
              setViewMode("inbox");
              setCategory("learning");
            }}
            className={`relative rounded-lg px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
              viewMode === "inbox"
                ? "bg-surface-hover text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Inbox className="mr-1 inline h-3.5 w-3.5" />
            Inbox
            {inboxCount > 0 && (
              <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                {inboxCount > 99 ? "99+" : inboxCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="rounded-xl border border-border bg-surface p-6">
        {viewMode === "inbox" ? (
          <InboxView />
        ) : viewMode === "latest" ? (
          isLoading ? (
            <DigestViewSkeleton />
          ) : latestDigest ? (
            <DigestView digest={latestDigest} />
          ) : (
            <DigestEmptyState />
          )
        ) : (
          <DigestHistory category={category} />
        )}
      </div>
    </div>
  );
}
