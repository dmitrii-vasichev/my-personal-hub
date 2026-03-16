"use client";

import { Radio } from "lucide-react";
import Link from "next/link";
import { useDashboardPulse } from "@/hooks/use-dashboard-pulse";

function WidgetSkeleton() {
  return (
    <div className="rounded-xl border border-border-subtle bg-card p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-4 w-4 rounded bg-muted animate-pulse" />
        <div className="h-4 w-12 rounded bg-muted animate-pulse" />
      </div>
      <div className="h-5 w-48 rounded bg-muted animate-pulse mb-2" />
      <div className="h-4 w-32 rounded bg-muted animate-pulse" />
    </div>
  );
}

export function PulseDigestWidget() {
  const { data: digest, isLoading } = useDashboardPulse();

  if (isLoading) {
    return <WidgetSkeleton />;
  }

  return (
    <Link href="/pulse" className="block">
      <div className="rounded-xl border border-border-subtle bg-card p-5 transition-colors duration-150 hover:bg-card-hover hover:border-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span
              className="flex h-[32px] w-[32px] items-center justify-center rounded-lg"
              style={{ color: "var(--accent-violet)", background: "var(--accent-violet-muted)" }}
            >
              <Radio size={16} />
            </span>
            <span className="text-[13px] font-medium text-muted-foreground">Pulse</span>
          </div>
          <span className="text-[12px] text-tertiary">View digest &rarr;</span>
        </div>

        {digest ? (
          <>
            <p className="text-sm text-foreground">
              {digest.message_count} messages in latest digest
            </p>
            <p className="text-[12px] text-tertiary mt-1">
              {new Date(digest.generated_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
              {digest.category && ` \u00b7 ${digest.category}`}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No digests yet — configure sources to get started
          </p>
        )}
      </div>
    </Link>
  );
}
