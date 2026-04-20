"use client";

import { useMemo } from "react";
import type { ApplicationStatus, Job } from "@/types/job";

interface JobsHeroProps {
  jobs: Job[];
}

// Disjoint buckets — each job counts in at most one cell.
const HERO_BUCKET_STATUSES: Record<string, ApplicationStatus[]> = {
  Applied: ["applied"],
  Screen: ["screening"],
  Interview: ["technical_interview", "final_interview"],
  Offer: ["offer"],
};

type BucketLabel = keyof typeof HERO_BUCKET_STATUSES;

const BUCKET_ORDER: BucketLabel[] = ["Applied", "Screen", "Interview", "Offer"];

// Accent color per bucket (brutalist tokens).
const BUCKET_ACCENT: Record<BucketLabel, string> = {
  Applied: "var(--ink)",
  Screen: "var(--ink)",
  Interview: "var(--accent-2)",
  Offer: "var(--accent-3)",
};

export function JobsHero({ jobs }: JobsHeroProps) {
  const counts = useMemo(() => {
    const byBucket: Record<BucketLabel, number> = {
      Applied: 0,
      Screen: 0,
      Interview: 0,
      Offer: 0,
    };
    for (const j of jobs) {
      if (!j.status) continue;
      for (const bucket of BUCKET_ORDER) {
        if (HERO_BUCKET_STATUSES[bucket].includes(j.status)) {
          byBucket[bucket] += 1;
          break;
        }
      }
    }
    return byBucket;
  }, [jobs]);

  const max = Math.max(counts.Applied, counts.Screen, counts.Interview, counts.Offer);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 border-[1.5px] border-[color:var(--line)]">
      {BUCKET_ORDER.map((bucket, i) => {
        const count = counts[bucket];
        const width = max > 0 ? (count / max) * 100 : 0;
        const accent = BUCKET_ACCENT[bucket];
        return (
          <div
            key={bucket}
            data-testid={`jobs-hero-cell-${bucket.toLowerCase()}`}
            className={`bg-[color:var(--bg-2)] p-[14px_16px] flex flex-col gap-2 min-h-[88px] border-[color:var(--line)] ${
              i > 0 ? "border-l-0 md:border-l-[1.5px]" : ""
            } ${i < 2 ? "border-b-[1.5px] md:border-b-0" : ""} ${
              i % 2 === 0 && i < 2 ? "" : ""
            }`}
          >
            <div className="text-[11px] uppercase tracking-[1.5px] text-[color:var(--ink-3)] font-mono">
              {bucket}
            </div>
            <div className="font-[family-name:var(--font-space-grotesk)] font-bold text-[26px] leading-[1] tracking-[-0.6px] text-[color:var(--ink)]">
              {count}
            </div>
            <div
              className="h-[3px] w-full bg-[color:var(--line)]"
              aria-hidden
            >
              <div
                data-testid={`jobs-hero-bar-${bucket.toLowerCase()}`}
                className="h-full transition-all"
                style={{
                  width: `${width}%`,
                  backgroundColor: accent,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
