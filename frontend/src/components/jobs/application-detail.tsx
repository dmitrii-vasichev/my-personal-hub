"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Briefcase,
  Calendar,
  ChevronDown,
  Clock,
  Edit,
  Mail,
  MapPin,
  Trash2,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApplicationEditDialog } from "@/components/jobs/application-edit-dialog";
import { ApplicationTimeline } from "@/components/jobs/application-timeline";
import { StatusChangeDialog } from "@/components/jobs/status-change-dialog";
import {
  useDeleteApplication,
  useStatusHistory,
} from "@/hooks/use-applications";
import {
  APPLICATION_STATUS_COLORS,
  APPLICATION_STATUS_LABELS,
} from "@/types/job";
import type { Application } from "@/types/job";

const REJECTION_STATUSES = ["rejected", "ghosted", "withdrawn"] as const;

interface ApplicationDetailProps {
  application: Application;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ApplicationDetail({ application }: ApplicationDetailProps) {
  const router = useRouter();
  const deleteApplication = useDeleteApplication();
  const { data: history = [] } = useStatusHistory(application.id);

  const [editOpen, setEditOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);

  const handleDelete = async () => {
    if (
      !confirm(
        `Delete this application for "${application.job?.title ?? "this job"}"? This cannot be undone.`
      )
    )
      return;
    await deleteApplication.mutateAsync(application.id);
    router.push("/jobs?tab=pipeline");
  };

  const statusColor = APPLICATION_STATUS_COLORS[application.status];
  const statusLabel = APPLICATION_STATUS_LABELS[application.status];
  const showRejectionReason =
    (REJECTION_STATUSES as readonly string[]).includes(application.status) && !!application.rejection_reason;

  return (
    <div className="mx-auto max-w-4xl">
      {/* Top bar */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <button
          onClick={() => router.push("/jobs?tab=pipeline")}
          className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Pipeline
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
            disabled={deleteApplication.isPending}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      </div>

      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)] leading-tight">
          {application.job?.title ?? "Untitled Position"}
        </h1>
        {application.job?.company && (
          <div className="flex items-center gap-1.5 mt-1">
            <Briefcase className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
            <span className="text-sm text-[var(--text-secondary)]">{application.job.company}</span>
          </div>
        )}

        {/* Status badge + status change */}
        <div className="flex items-center gap-3 mt-3">
          <span
            className="inline-flex items-center rounded px-2.5 py-1 text-xs font-medium"
            style={{
              color: statusColor,
              backgroundColor: `${statusColor}18`,
            }}
          >
            {statusLabel}
          </span>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setStatusDialogOpen(true)}
          >
            Change Status
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        {/* Left / main column */}
        <div className="flex flex-col gap-6">
          {/* Notes */}
          <div>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
              Notes
            </h3>
            {application.notes ? (
              <p className="text-sm leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap">
                {application.notes}
              </p>
            ) : (
              <p className="text-sm text-[var(--text-tertiary)] italic">No notes yet.</p>
            )}
          </div>

          {/* Recruiter */}
          {(application.recruiter_name || application.recruiter_contact) && (
            <div>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
                Recruiter
              </h3>
              <div className="flex flex-col gap-1.5">
                {application.recruiter_name && (
                  <div className="flex items-center gap-1.5 text-sm text-[var(--text-primary)]">
                    <User className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
                    {application.recruiter_name}
                  </div>
                )}
                {application.recruiter_contact && (
                  <div className="flex items-center gap-1.5 text-sm text-[var(--text-primary)]">
                    <Mail className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
                    {application.recruiter_contact}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Next action */}
          {(application.next_action || application.next_action_date) && (
            <div>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
                Next Action
              </h3>
              <div className="flex flex-col gap-1">
                {application.next_action && (
                  <p className="text-sm text-[var(--text-primary)]">{application.next_action}</p>
                )}
                {application.next_action_date && (
                  <div className="flex items-center gap-1.5 text-sm text-[var(--text-tertiary)]">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatDate(application.next_action_date)}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Applied date */}
          {application.applied_date && (
            <div>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
                Applied
              </h3>
              <div className="flex items-center gap-1.5 text-sm text-[var(--text-primary)]">
                <Calendar className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
                {formatDate(application.applied_date)}
              </div>
            </div>
          )}

          {/* Rejection reason */}
          {showRejectionReason && (
            <div>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
                Rejection Reason
              </h3>
              <p className="text-sm leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap">
                {application.rejection_reason}
              </p>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="flex flex-col gap-5 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 h-fit">
          {/* Job summary */}
          {application.job && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
                Job
              </span>
              <button
                onClick={() => router.push(`/jobs/${application.job!.id}`)}
                className="flex flex-col gap-1 text-left group"
              >
                <span className="text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors leading-snug">
                  {application.job.title}
                </span>
                <div className="flex items-center gap-1 text-xs text-[var(--text-tertiary)]">
                  <Briefcase className="h-3 w-3 shrink-0" />
                  {application.job.company}
                </div>
                {application.job.location && (
                  <div className="flex items-center gap-1 text-xs text-[var(--text-tertiary)]">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {application.job.location}
                  </div>
                )}
              </button>
            </div>
          )}

          {application.job && <div className="border-t border-[var(--border)]" />}

          {/* Dates */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
              Dates
            </span>
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]">
              <Clock className="h-3 w-3" />
              Created {formatDate(application.created_at)}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]">
              <Clock className="h-3 w-3" />
              Updated {formatDate(application.updated_at)}
            </div>
          </div>
        </div>
      </div>

      {/* Status history timeline */}
      <div className="mt-8">
        <h3 className="mb-4 text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
          Status History
        </h3>
        <ApplicationTimeline history={history} />
      </div>

      {/* Edit dialog */}
      {editOpen && (
        <ApplicationEditDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          application={application}
          onSuccess={() => setEditOpen(false)}
        />
      )}

      {/* Status change dialog */}
      <StatusChangeDialog
        open={statusDialogOpen}
        onOpenChange={setStatusDialogOpen}
        applicationId={application.id}
        currentStatus={application.status}
        onSuccess={() => setStatusDialogOpen(false)}
      />
    </div>
  );
}
