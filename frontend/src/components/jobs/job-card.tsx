"use client";

import { Briefcase, MapPin, DollarSign, Tag, Pencil, Trash2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Job } from "@/types/job";
import { APPLICATION_STATUS_LABELS, APPLICATION_STATUS_COLORS } from "@/types/job";

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
  const hasApplication = !!job.application;

  return (
    <div className="group bg-[#131316] border border-[#232329] rounded-lg p-4 hover:border-[#3a3a45] transition-colors">
      {/* Header row: title + actions */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-[#EDEDEF] leading-snug line-clamp-1">
            {job.title}
          </h3>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Briefcase className="h-3 w-3 text-[#8B8B93] shrink-0" />
            <span className="text-xs text-[#8B8B93] truncate">{job.company}</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(job)}
            className="p-1.5 rounded-md text-[#5C5C66] hover:text-[#EDEDEF] hover:bg-[#232329] transition-colors"
            title="Edit job"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onDelete(job)}
            className="p-1.5 rounded-md text-[#5C5C66] hover:text-[#E5484D] hover:bg-[#232329] transition-colors"
            title="Delete job"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Meta row: location + salary */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        {job.location && (
          <div className="flex items-center gap-1">
            <MapPin className="h-3 w-3 text-[#5C5C66] shrink-0" />
            <span className="text-xs text-[#8B8B93]">{job.location}</span>
          </div>
        )}
        {salary && (
          <div className="flex items-center gap-1">
            <DollarSign className="h-3 w-3 text-[#5C5C66] shrink-0" />
            <span className="text-xs text-[#8B8B93]">{salary}</span>
          </div>
        )}
        {job.source && (
          <span className="text-xs text-[#5C5C66] font-mono">{job.source}</span>
        )}
      </div>

      {/* Tags */}
      {job.tags.length > 0 && (
        <div className="flex items-center gap-1.5 mb-3 flex-wrap">
          <Tag className="h-3 w-3 text-[#5C5C66] shrink-0" />
          {job.tags.slice(0, 5).map((tag) => (
            <span
              key={tag}
              className="px-1.5 py-0.5 rounded text-[11px] bg-[#1a1a1f] border border-[#232329] text-[#8B8B93]"
            >
              {tag}
            </span>
          ))}
          {job.tags.length > 5 && (
            <span className="text-[11px] text-[#5C5C66]">+{job.tags.length - 5}</span>
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
                  ? "bg-[#0d2d1f] text-[#30A46C]"
                  : job.match_score >= 60
                  ? "bg-[#2d2207] text-[#F5A623]"
                  : "bg-[#1a1a1f] text-[#8B8B93]"
              }`}
            >
              {job.match_score}% match
            </span>
          )}

          {/* Application status badge */}
          {hasApplication && job.application && (
            <span
              className="px-1.5 py-0.5 rounded text-[11px] font-medium"
              style={{
                color: APPLICATION_STATUS_COLORS[job.application.status],
                backgroundColor: `${APPLICATION_STATUS_COLORS[job.application.status]}18`,
              }}
            >
              {APPLICATION_STATUS_LABELS[job.application.status]}
            </span>
          )}
        </div>

        {/* Track / Tracking button */}
        {hasApplication ? (
          <div className="flex items-center gap-1 text-[11px] text-[#30A46C]">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Tracking</span>
          </div>
        ) : (
          <Button
            size="sm"
            onClick={() => onTrack(job)}
            disabled={isTracking}
            className="h-7 px-2.5 text-xs bg-[#5B6AD0] hover:bg-[#6E7CE0] text-white border-0"
          >
            {isTracking ? "Adding…" : "Track"}
          </Button>
        )}
      </div>
    </div>
  );
}
