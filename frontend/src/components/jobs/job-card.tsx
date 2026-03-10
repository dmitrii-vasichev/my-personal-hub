"use client";

import { Briefcase, MapPin, DollarSign, Tag, Pencil, Trash2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import type { Job } from "@/types/job";
import { APPLICATION_STATUS_LABELS, APPLICATION_STATUS_COLORS, APPLICATION_STATUS_BG_COLORS } from "@/types/job";

interface JobCardProps {
  job: Job;
  onEdit: (job: Job) => void;
  onDelete: (job: Job) => void;
  onTrack: (job: Job) => void;
  isTracking?: boolean;
}

function formatSalary(min?: number, max?: number, currency = "USD"): string | null {
  if (!min && !max) return null;
  const fmt = (n: number) => `${currency} ${(n / 1000).toFixed(0)}k`;
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `from ${fmt(min)}`;
  return `up to ${fmt(max!)}`;
}

export function JobCard({ job, onEdit, onDelete, onTrack, isTracking = false }: JobCardProps) {
  const salary = formatSalary(job.salary_min, job.salary_max, job.salary_currency);
  const hasStatus = !!job.status;

  return (
    <div className="group rounded-lg border border-border-subtle bg-card p-4 hover:border-border transition-colors">
      {/* Header row: title + actions */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground leading-snug line-clamp-1">
            {job.title}
          </h3>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Briefcase className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground truncate">{job.company}</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <Tooltip content="Edit job">
            <button
              onClick={() => onEdit(job)}
              className="p-1.5 rounded-md text-tertiary hover:text-foreground hover:bg-surface-hover transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
          <Tooltip content="Delete job">
            <button
              onClick={() => onDelete(job)}
              className="p-1.5 rounded-md text-tertiary hover:text-destructive hover:bg-surface-hover transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Meta row: location + salary */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        {job.location && (
          <div className="flex items-center gap-1">
            <MapPin className="h-3 w-3 text-tertiary shrink-0" />
            <span className="text-xs text-muted-foreground">{job.location}</span>
          </div>
        )}
        {salary && (
          <div className="flex items-center gap-1">
            <DollarSign className="h-3 w-3 text-tertiary shrink-0" />
            <span className="text-xs text-muted-foreground">{salary}</span>
          </div>
        )}
        {job.source && (
          <span className="text-xs text-tertiary font-mono">{job.source}</span>
        )}
      </div>

      {/* Tags */}
      {job.tags.length > 0 && (
        <div className="flex items-center gap-1.5 mb-3 flex-wrap">
          <Tag className="h-3 w-3 text-tertiary shrink-0" />
          {job.tags.slice(0, 5).map((tag) => (
            <span
              key={tag}
              className="px-1.5 py-0.5 rounded text-[11px] bg-muted border border-border-subtle text-muted-foreground"
            >
              {tag}
            </span>
          ))}
          {job.tags.length > 5 && (
            <span className="text-[11px] text-tertiary">+{job.tags.length - 5}</span>
          )}
        </div>
      )}

      {/* Footer: match score + application status + track button */}
      <div className="flex items-center justify-between gap-2 mt-auto">
        <div className="flex items-center gap-2">
          {/* Match score badge */}
          {job.match_score !== undefined && job.match_score !== null && (
            <span
              className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${
                job.match_score >= 80
                  ? "bg-accent-teal-muted text-accent-teal"
                  : job.match_score >= 60
                  ? "bg-accent-amber-muted text-accent-amber"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {job.match_score}% match
            </span>
          )}

          {/* Status badge */}
          {hasStatus && job.status && (
            <span
              className="px-1.5 py-0.5 rounded text-[11px] font-medium"
              style={{
                color: APPLICATION_STATUS_COLORS[job.status],
                backgroundColor: APPLICATION_STATUS_BG_COLORS[job.status],
              }}
            >
              {APPLICATION_STATUS_LABELS[job.status]}
            </span>
          )}
        </div>

        {/* Track / Tracking button */}
        {hasStatus ? (
          <div className="flex items-center gap-1 text-[11px] text-accent-teal">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Tracking</span>
          </div>
        ) : (
          <Button
            size="sm"
            onClick={() => onTrack(job)}
            disabled={isTracking}
          >
            {isTracking ? "Adding…" : "Track"}
          </Button>
        )}
      </div>
    </div>
  );
}
