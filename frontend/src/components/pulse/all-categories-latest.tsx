"use client";

import { useLatestDigest } from "@/hooks/use-pulse-digests";
import { CATEGORY_LABELS } from "@/types/pulse-source";
import { DigestView, DigestViewSkeleton, DigestEmptyState } from "./digest-view";

export function AllCategoriesLatest() {
  const news = useLatestDigest("news");
  const jobs = useLatestDigest("jobs");
  const learning = useLatestDigest("learning");

  const entries = [
    { key: "news", label: CATEGORY_LABELS.news, ...news },
    { key: "jobs", label: CATEGORY_LABELS.jobs, ...jobs },
    { key: "learning", label: CATEGORY_LABELS.learning, ...learning },
  ];

  const isLoading = entries.some((e) => e.isLoading);
  if (isLoading) return <DigestViewSkeleton />;

  const available = entries.filter((e) => e.data);
  if (available.length === 0) return <DigestEmptyState />;

  return (
    <div className="space-y-6">
      {available.map((e) => (
        <div key={e.key}>
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {e.label}
          </h3>
          <DigestView digest={e.data!} />
        </div>
      ))}
    </div>
  );
}
