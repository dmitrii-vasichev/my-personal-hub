"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Briefcase,
  Calendar,
  Clock,
  Copy,
  DollarSign,
  Edit,
  ExternalLink,
  Mail,
  MapPin,
  Tag,
  Trash2,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { JobDialog } from "@/components/jobs/job-dialog";
import { StatusChangeDialog } from "@/components/jobs/status-change-dialog";
import { JobTrackingEditDialog } from "@/components/jobs/job-tracking-edit-dialog";
import { JobMatchSection } from "@/components/jobs/job-match-section";
import { LinkedTasksSection } from "@/components/jobs/linked-tasks-section";
import { LinkedEventsSection } from "@/components/jobs/linked-events-section";
import { ResumeSection } from "@/components/jobs/resume-section";
import { CoverLetterSection } from "@/components/jobs/cover-letter-section";
import { ApplicationTimeline } from "@/components/jobs/application-timeline";
import { useDeleteJob, useChangeJobStatus, useStatusHistory } from "@/hooks/use-jobs";
import { APPLICATION_STATUS_LABELS, APPLICATION_STATUS_COLORS, APPLICATION_STATUS_BG_COLORS } from "@/types/job";
import type { Job } from "@/types/job";

interface JobDetailProps {
  job: Job;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatSalary(min?: number, max?: number, currency = "USD"): string | null {
  if (!min && !max) return null;
  const fmt = (n: number) =>
    `${currency} ${n >= 1000 ? `${(n / 1000).toFixed(0)}k` : n.toLocaleString()}`;
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `from ${fmt(min)}`;
  return `up to ${fmt(max!)}`;
}

const REJECTION_STATUSES = ["rejected", "ghosted", "withdrawn"] as const;

export function JobDetail({ job }: JobDetailProps) {
  const router = useRouter();
  const deleteJob = useDeleteJob();
  const changeJobStatus = useChangeJobStatus();
  const { data: history = [] } = useStatusHistory(job.id);
  const [editOpen, setEditOpen] = useState(false);
  const [trackingEditOpen, setTrackingEditOpen] = useState(false);
  const [isStartingTracking, setIsStartingTracking] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);

  const salary = formatSalary(job.salary_min, job.salary_max, job.salary_currency);
  const hasStatus = !!job.status;
  const showRejectionReason =
    hasStatus && (REJECTION_STATUSES as readonly string[]).includes(job.status!) && !!job.rejection_reason;

  const handleDelete = async () => {
    if (!confirm(`Delete "${job.title}" at ${job.company}? This action cannot be undone.`)) return;
    await deleteJob.mutateAsync(job.id);
    router.push("/jobs");
  };

  const handleStartTracking = async () => {
    setIsStartingTracking(true);
    try {
      await changeJobStatus.mutateAsync({
        id: job.id,
        data: { new_status: "found" },
      });
      toast.success("Tracking started");
    } catch {
      // Stay on page if tracking fails
    } finally {
      setIsStartingTracking(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      {/* Top bar */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <button
          onClick={() => router.push("/jobs")}
          className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Jobs
        </button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Edit className="h-3.5 w-3.5" />
            Edit
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={deleteJob.isPending}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      </div>

      {/* Page header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-mono text-xs text-[var(--text-tertiary)]">JOB-{job.id}</span>
          {job.match_score !== undefined && job.match_score !== null && (
            <span
              className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${
                job.match_score >= 80
                  ? "bg-[#0f2d22] text-[#34d399]"
                  : job.match_score >= 60
                  ? "bg-[#2a2510] text-[#fbbf24]"
                  : "bg-[var(--surface-hover)] text-[var(--text-tertiary)]"
              }`}
            >
              {job.match_score}% match
            </span>
          )}
        </div>
        <h1 className="text-2xl font-semibold text-[var(--text-primary)] leading-tight">
          {job.title}
        </h1>
        <div className="flex items-center gap-1.5 mt-1">
          <Briefcase className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
          <span className="text-sm text-[var(--text-secondary)]">{job.company}</span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        {/* Main content */}
        <div className="flex flex-col gap-6">
          {/* Description */}
          {job.description ? (
            <div>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
                Description
              </h3>
              <p className="text-sm leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap">
                {job.description}
              </p>
            </div>
          ) : (
            <p className="text-sm text-[var(--text-tertiary)] italic">No description provided.</p>
          )}

          {/* AI Match Analysis */}
          <JobMatchSection job={job} />

          {/* Source URL */}
          <div>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
              Job Posting
            </h3>
            {job.url ? (
              <div className="flex items-center gap-2">
                <a
                  href={job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-semibold bg-[var(--accent-muted)] text-[var(--accent-foreground)] border border-[rgba(79,142,247,0.2)] hover:bg-[rgba(79,142,247,0.15)] transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                  View Original Posting
                </a>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(job.url!);
                    toast.success("URL copied to clipboard");
                  }}
                  className="p-1.5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
                  title="Copy URL"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <p className="text-sm text-[var(--text-tertiary)]">No source link</p>
            )}
          </div>

          {/* Tags */}
          {job.tags.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
                Tags
              </h3>
              <div className="flex items-center gap-1.5 flex-wrap">
                <Tag className="h-3 w-3 text-[var(--text-tertiary)] shrink-0" />
                {job.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-1.5 py-0.5 rounded text-[11px] bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-secondary)]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Tracking info sections (only when tracked) */}
          {hasStatus && (
            <>
              {job.notes && (
                <div>
                  <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
                    Notes
                  </h3>
                  <p className="text-sm leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap">
                    {job.notes}
                  </p>
                </div>
              )}

              {(job.recruiter_name || job.recruiter_contact) && (
                <div>
                  <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
                    Recruiter
                  </h3>
                  <div className="flex flex-col gap-1.5">
                    {job.recruiter_name && (
                      <div className="flex items-center gap-1.5 text-sm text-[var(--text-primary)]">
                        <User className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
                        {job.recruiter_name}
                      </div>
                    )}
                    {job.recruiter_contact && (
                      <div className="flex items-center gap-1.5 text-sm text-[var(--text-primary)]">
                        <Mail className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
                        {job.recruiter_contact}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {(job.next_action || job.next_action_date) && (
                <div>
                  <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
                    Next Action
                  </h3>
                  <div className="flex flex-col gap-1">
                    {job.next_action && (
                      <p className="text-sm text-[var(--text-primary)]">{job.next_action}</p>
                    )}
                    {job.next_action_date && (
                      <div className="flex items-center gap-1.5 text-sm text-[var(--text-tertiary)]">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDate(job.next_action_date)}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {job.applied_date && (
                <div>
                  <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
                    Applied
                  </h3>
                  <div className="flex items-center gap-1.5 text-sm text-[var(--text-primary)]">
                    <Calendar className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
                    {formatDate(job.applied_date)}
                  </div>
                </div>
              )}

              {showRejectionReason && (
                <div>
                  <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
                    Rejection Reason
                  </h3>
                  <p className="text-sm leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap">
                    {job.rejection_reason}
                  </p>
                </div>
              )}
            </>
          )}

          {/* Linked Tasks */}
          <LinkedTasksSection jobId={job.id} />

          {/* Linked Events */}
          <LinkedEventsSection jobId={job.id} />

          {/* Resume section (only when tracked) */}
          {hasStatus && (
            <div className="mt-2">
              <ResumeSection jobId={job.id} />
            </div>
          )}

          {/* Cover Letter section (only when tracked) */}
          {hasStatus && (
            <div>
              <CoverLetterSection jobId={job.id} />
            </div>
          )}

          {/* Status History (only when tracked) */}
          {hasStatus && history.length > 0 && (
            <div>
              <h3 className="mb-4 text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
                Status History
              </h3>
              <ApplicationTimeline history={history} />
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-5 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 h-fit">
          {/* Tracking status section */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
              Tracking
            </span>
            {hasStatus && job.status ? (
              <div className="flex flex-col gap-2">
                <span
                  className="inline-flex w-fit items-center rounded-md px-2.5 py-1 text-xs font-medium"
                  style={{
                    color: APPLICATION_STATUS_COLORS[job.status],
                    backgroundColor: APPLICATION_STATUS_BG_COLORS[job.status],
                  }}
                >
                  {APPLICATION_STATUS_LABELS[job.status]}
                </span>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStatusDialogOpen(true)}
                  className="w-full justify-center text-xs"
                >
                  Change Status
                </Button>

                <button
                  onClick={() => setTrackingEditOpen(true)}
                  className="text-xs text-[var(--accent-foreground)] hover:text-[var(--accent-hover)] transition-colors text-center"
                >
                  Edit Tracking Info
                </button>
              </div>
            ) : (
              <Button
                size="sm"
                onClick={handleStartTracking}
                disabled={isStartingTracking}
                className="w-full justify-center text-xs bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white border-0"
              >
                {isStartingTracking ? "Starting…" : "Start Tracking"}
              </Button>
            )}
          </div>

          <div className="border-t border-[var(--border)]" />

          {job.location && (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
                Location
              </span>
              <div className="flex items-center gap-1.5 text-sm text-[var(--text-primary)]">
                <MapPin className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
                {job.location}
              </div>
            </div>
          )}

          {salary && (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
                Salary
              </span>
              <div className="flex items-center gap-1.5 text-sm text-[var(--text-primary)]">
                <DollarSign className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
                {salary}
              </div>
            </div>
          )}

          {job.source && (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
                Source
              </span>
              <span className="text-sm font-mono text-[var(--text-primary)]">{job.source}</span>
            </div>
          )}

          {job.found_at && (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
                Found
              </span>
              <div className="flex items-center gap-1.5 text-sm text-[var(--text-primary)]">
                <Calendar className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
                {formatDate(job.found_at)}
              </div>
            </div>
          )}

          <div className="border-t border-[var(--border)] pt-3 flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]">
              <Clock className="h-3 w-3" />
              Created {formatDate(job.created_at)}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]">
              <Clock className="h-3 w-3" />
              Updated {formatDate(job.updated_at)}
            </div>
          </div>
        </div>
      </div>

      {editOpen && (
        <JobDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          mode="edit"
          job={job}
          onSuccess={() => setEditOpen(false)}
        />
      )}

      {trackingEditOpen && (
        <JobTrackingEditDialog
          open={trackingEditOpen}
          onOpenChange={setTrackingEditOpen}
          job={job}
          onSuccess={() => setTrackingEditOpen(false)}
        />
      )}

      {hasStatus && job.status && statusDialogOpen && (
        <StatusChangeDialog
          open={statusDialogOpen}
          onOpenChange={setStatusDialogOpen}
          jobId={job.id}
          currentStatus={job.status}
          onSuccess={() => setStatusDialogOpen(false)}
        />
      )}
    </div>
  );
}
