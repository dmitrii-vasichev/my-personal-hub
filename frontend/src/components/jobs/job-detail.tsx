"use client";

import { useState, useCallback } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Tooltip } from "@/components/ui/tooltip";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Briefcase,
  Calendar,
  Clock,
  Copy,
  ExternalLink,
  Mail,
  MapPin,
  Trash2,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { InlineEditText } from "@/components/ui/inline-edit-text";
import { InlineEditTags } from "@/components/ui/inline-edit-tags";
import { CollapsibleDescription } from "@/components/ui/collapsible-description";
import { InlineEditSalary } from "@/components/ui/inline-edit-salary";
import { StatusChangeDialog } from "@/components/jobs/status-change-dialog";
import { JobTrackingEditDialog } from "@/components/jobs/job-tracking-edit-dialog";
import { JobMatchSection } from "@/components/jobs/job-match-section";
import { LinkedTasksSection } from "@/components/jobs/linked-tasks-section";
import { LinkedEventsSection } from "@/components/jobs/linked-events-section";
import { LinkedNotesSection } from "@/components/notes/linked-notes-section";
import {
  useJobLinkedNotes,
  useLinkNoteToJob,
  useUnlinkNoteFromJob,
} from "@/hooks/use-note-links";
import { ResumeSection } from "@/components/jobs/resume-section";
import { CoverLetterSection } from "@/components/jobs/cover-letter-section";
import { ApplicationTimeline } from "@/components/jobs/application-timeline";
import { useDeleteJob, useUpdateJob, useChangeJobStatus, useStatusHistory } from "@/hooks/use-jobs";
import { APPLICATION_STATUS_LABELS, APPLICATION_STATUS_COLORS, APPLICATION_STATUS_BG_COLORS } from "@/types/job";
import type { Job, UpdateJobInput } from "@/types/job";

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

const REJECTION_STATUSES = ["rejected", "ghosted", "withdrawn"] as const;

// --- Main Component ---

export function JobDetail({ job }: JobDetailProps) {
  const router = useRouter();
  const deleteJob = useDeleteJob();
  const updateJob = useUpdateJob();
  const changeJobStatus = useChangeJobStatus();
  const { data: history = [] } = useStatusHistory(job.id);
  const [trackingEditOpen, setTrackingEditOpen] = useState(false);
  const [isStartingTracking, setIsStartingTracking] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);

  const { data: linkedNotes = [], isLoading: notesLoading } = useJobLinkedNotes(job.id);
  const linkNote = useLinkNoteToJob(job.id);
  const unlinkNote = useUnlinkNoteFromJob(job.id);

  const hasStatus = !!job.status;
  const showRejectionReason =
    hasStatus && (REJECTION_STATUSES as readonly string[]).includes(job.status!) && !!job.rejection_reason;

  const patchJob = useCallback(
    async (data: UpdateJobInput) => {
      await updateJob.mutateAsync({ id: job.id, data });
      toast.success("Updated");
    },
    [job.id, updateJob]
  );

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDelete = async () => {
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
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setShowDeleteConfirm(true)}
          disabled={deleteJob.isPending}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </Button>
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        title="Delete Job"
        description={`Delete "${job.title}" at ${job.company}? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleteJob.isPending}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        {/* Main content */}
        <div className="flex flex-col gap-6">
          {/* Page header */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs text-[var(--text-tertiary)]">JOB-{job.id}</span>
              {job.match_score !== undefined && job.match_score !== null && (
                <span
                  className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${
                    job.match_score >= 80
                      ? "bg-accent-teal-muted text-accent-teal"
                      : job.match_score >= 60
                      ? "bg-accent-amber-muted text-accent-amber"
                      : "bg-surface-hover text-tertiary"
                  }`}
                >
                  {job.match_score}% match
                </span>
              )}
            </div>
            <h1 className="text-2xl font-semibold text-[var(--text-primary)] leading-tight">
              <InlineEditText
                value={job.title}
                onSave={(v) => patchJob({ title: v.trim() || job.title })}
                inputClassName="text-2xl font-semibold w-full"
                placeholder="Job title"
              />
            </h1>
            <div className="flex items-center gap-1.5 mt-1">
              <Briefcase className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
              <InlineEditText
                value={job.company}
                onSave={(v) => patchJob({ company: v.trim() || job.company })}
                className="text-sm text-[var(--text-secondary)]"
                inputClassName="text-sm"
                placeholder="Company"
              />
            </div>
          </div>

          {/* Description */}
          <CollapsibleDescription
            description={job.description ?? ""}
            onSave={(v) => patchJob({ description: v.trim() || null })}
            placeholder="Add description…"
          />

          {/* AI Match Analysis */}
          <JobMatchSection job={job} />

          {/* Source URL */}
          <div className="group/url">
            <div className="flex items-center gap-1.5 mb-2">
              <h3 className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
                Job Posting
              </h3>
            </div>
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
                <Tooltip content="Copy URL">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(job.url!);
                    toast.success("URL copied to clipboard");
                  }}
                  className="p-1.5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
                </Tooltip>
              </div>
            ) : (
              <p className="text-sm text-[var(--text-tertiary)]">No URL</p>
            )}
          </div>

          {/* Tags */}
          <div>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
              Tags
            </h3>
            <InlineEditTags
              tags={job.tags}
              onSave={(tags) => patchJob({ tags })}
            />
          </div>

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

          {/* Linked Tasks */}
          <LinkedTasksSection jobId={job.id} />

          {/* Linked Events */}
          <LinkedEventsSection jobId={job.id} />

          {/* Linked Notes */}
          <LinkedNotesSection
            notes={linkedNotes}
            isLoading={notesLoading}
            onLink={(noteId) => linkNote.mutate(noteId)}
            onUnlink={(noteId) => unlinkNote.mutate(noteId)}
            isLinking={linkNote.isPending}
          />

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

          {/* Location */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
              Location
            </span>
            <div className="flex items-center gap-1.5 text-sm text-[var(--text-primary)]">
              <MapPin className="h-3.5 w-3.5 text-[var(--text-tertiary)] shrink-0" />
              <InlineEditText
                value={job.location ?? ""}
                onSave={(v) => patchJob({ location: v.trim() || null })}
                className="text-sm"
                inputClassName="text-sm"
                placeholder="Add location"
              />
            </div>
          </div>

          {/* Salary */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
              Salary
            </span>
            <InlineEditSalary
              min={job.salary_min}
              max={job.salary_max}
              currency={job.salary_currency ?? "USD"}
              onSave={(data) => patchJob(data)}
            />
          </div>

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
