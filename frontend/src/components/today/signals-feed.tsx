"use client";

import { useLatestDigest } from "@/hooks/use-pulse-digests";

const CATEGORIES: { key: string; label: string }[] = [
  { key: "pulse", label: "Pulse" },
  { key: "jobs", label: "Jobs" },
  { key: "outreach", label: "Outreach" },
  { key: "notes", label: "Notes" },
];

function DigestCell({
  category,
  label,
}: {
  category: string;
  label: string;
}) {
  const { data: digest } = useLatestDigest(category);

  if (!digest) {
    return (
      <div className="p-[12px_14px] border-b md:border-b-0 md:border-r last:border-r-0 border-[color:var(--line)]">
        <div className="text-[9.5px] tracking-[1.5px] uppercase text-[color:var(--ink-3)] font-semibold mb-2">
          {label}
        </div>
        <p className="text-[11.5px] text-[color:var(--ink-3)] leading-[1.4]">
          No recent signal.
        </p>
      </div>
    );
  }

  const preview = digest.content?.slice(0, 220) ?? "";
  return (
    <div className="p-[12px_14px] border-b md:border-b-0 md:border-r last:border-r-0 border-[color:var(--line)]">
      <div className="text-[9.5px] tracking-[1.5px] uppercase text-[color:var(--accent)] font-semibold mb-2">
        {label}
      </div>
      <p className="text-[11.5px] text-[color:var(--ink)] leading-[1.4] whitespace-pre-wrap line-clamp-4">
        {preview}
      </p>
      <div className="mt-2 text-[10px] text-[color:var(--ink-4)] tracking-[0.5px]">
        {new Date(digest.generated_at).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })}
      </div>
    </div>
  );
}

export function SignalsFeed() {
  return (
    <div className="border-[1.5px] border-[color:var(--line)] grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
      {CATEGORIES.map((c) => (
        <DigestCell key={c.key} category={c.key} label={c.label} />
      ))}
    </div>
  );
}
