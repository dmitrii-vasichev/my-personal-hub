"use client";

import { APPLICATION_STATUS_COLORS, APPLICATION_STATUS_LABELS } from "@/types/job";
import type { ApplicationStatus, StatusHistoryEntry } from "@/types/job";

interface ApplicationTimelineProps {
  history: StatusHistoryEntry[];
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ApplicationTimeline({ history }: ApplicationTimelineProps) {
  if (history.length === 0) {
    return (
      <p className="text-sm text-[var(--text-tertiary)] italic">No history recorded yet.</p>
    );
  }

  return (
    <div className="flex flex-col">
      {history.map((entry, index) => {
        const isLast = index === history.length - 1;
        const isFirst = entry.old_status === null || entry.old_status === undefined;
        const statusColor = APPLICATION_STATUS_COLORS[entry.new_status as ApplicationStatus] ?? "#4b5563";
        const statusLabel = APPLICATION_STATUS_LABELS[entry.new_status as ApplicationStatus] ?? entry.new_status;

        return (
          <div key={entry.id} className="flex gap-3">
            {/* Timeline indicator column */}
            <div className="flex flex-col items-center" style={{ width: "20px", minWidth: "20px" }}>
              {/* Dot */}
              <div
                className="rounded-full shrink-0 mt-0.5"
                style={{
                  width: "8px",
                  height: "8px",
                  backgroundColor: statusColor,
                  boxShadow: `0 0 0 2px ${statusColor}22`,
                }}
              />
              {/* Connecting line */}
              {!isLast && (
                <div
                  className="flex-1 mt-1"
                  style={{
                    width: "2px",
                    backgroundColor: "var(--border)",
                    minHeight: "24px",
                  }}
                />
              )}
            </div>

            {/* Content column */}
            <div className={`flex flex-1 flex-col gap-0.5 ${isLast ? "pb-0" : "pb-4"}`}>
              <div className="flex items-baseline justify-between gap-3">
                <span
                  className="text-sm font-medium"
                  style={{ color: isFirst ? "var(--text-secondary)" : statusColor }}
                >
                  {isFirst ? "Started tracking" : `→ ${statusLabel}`}
                </span>
                <span className="text-xs text-[var(--text-tertiary)] whitespace-nowrap shrink-0">
                  {formatDateTime(entry.changed_at)}
                </span>
              </div>
              {entry.comment && (
                <p className="text-xs text-[var(--text-tertiary)] italic leading-relaxed">
                  &ldquo;{entry.comment}&rdquo;
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
