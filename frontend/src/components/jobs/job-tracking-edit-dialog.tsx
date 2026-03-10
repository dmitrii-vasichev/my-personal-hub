"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogPopup,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";
import { DatePicker } from "@/components/ui/date-picker";
import { useUpdateJobTracking } from "@/hooks/use-jobs";
import type { ApplicationStatus, Job } from "@/types/job";

const REJECTION_STATUSES: ApplicationStatus[] = ["rejected", "ghosted", "withdrawn"];

interface JobTrackingEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: Job;
  onSuccess?: () => void;
}

export function JobTrackingEditDialog({
  open,
  onOpenChange,
  job,
  onSuccess,
}: JobTrackingEditDialogProps) {
  const updateTracking = useUpdateJobTracking();

  const [notes, setNotes] = useState(job.notes ?? "");
  const [recruiterName, setRecruiterName] = useState(job.recruiter_name ?? "");
  const [recruiterContact, setRecruiterContact] = useState(job.recruiter_contact ?? "");
  const [appliedDate, setAppliedDate] = useState(
    job.applied_date ? job.applied_date.slice(0, 10) : ""
  );
  const [nextAction, setNextAction] = useState(job.next_action ?? "");
  const [nextActionDate, setNextActionDate] = useState(
    job.next_action_date ? job.next_action_date.slice(0, 10) : ""
  );
  const [rejectionReason, setRejectionReason] = useState(job.rejection_reason ?? "");
  const [error, setError] = useState<string | null>(null);

  const showRejectionReason = job.status ? REJECTION_STATUSES.includes(job.status) : false;
  const isLoading = updateTracking.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      await updateTracking.mutateAsync({
        id: job.id,
        data: {
          notes: notes.trim() || null,
          recruiter_name: recruiterName.trim() || null,
          recruiter_contact: recruiterContact.trim() || null,
          applied_date: appliedDate || null,
          next_action: nextAction.trim() || null,
          next_action_date: nextActionDate || null,
          rejection_reason: showRejectionReason ? (rejectionReason.trim() || null) : null,
        },
      });
      onSuccess?.();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isLoading) onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup className="w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
          <DialogClose />

          <DialogTitle className="mb-5">Edit Tracking Info</DialogTitle>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Notes */}
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="tracking-notes"
                className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide"
              >
                Notes
              </Label>
              <Textarea
                id="tracking-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes about this job…"
                rows={4}
              />
            </div>

            {/* Recruiter */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="tracking-recruiter-name"
                  className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide"
                >
                  Recruiter Name
                </Label>
                <Input
                  id="tracking-recruiter-name"
                  value={recruiterName}
                  onChange={(e) => setRecruiterName(e.target.value)}
                  placeholder="e.g. Jane Smith"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="tracking-recruiter-contact"
                  className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide"
                >
                  Recruiter Contact
                </Label>
                <Input
                  id="tracking-recruiter-contact"
                  value={recruiterContact}
                  onChange={(e) => setRecruiterContact(e.target.value)}
                  placeholder="email or phone"
                />
              </div>
            </div>

            {/* Applied Date */}
            <div className="flex flex-col gap-1.5">
              <Label
                className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide"
              >
                Applied Date
              </Label>
              <DatePicker
                value={appliedDate}
                onChange={setAppliedDate}
                placeholder="Select date"
              />
            </div>

            {/* Next Action */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="tracking-next-action"
                  className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide"
                >
                  Next Action
                </Label>
                <Input
                  id="tracking-next-action"
                  value={nextAction}
                  onChange={(e) => setNextAction(e.target.value)}
                  placeholder="e.g. Follow up email"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label
                  className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide"
                >
                  Next Action Date
                </Label>
                <DatePicker
                  value={nextActionDate}
                  onChange={setNextActionDate}
                  placeholder="No date"
                  clearable
                />
              </div>
            </div>

            {/* Rejection Reason (only for rejected/ghosted/withdrawn) */}
            {showRejectionReason && (
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="tracking-rejection-reason"
                  className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide"
                >
                  Rejection Reason
                </Label>
                <Textarea
                  id="tracking-rejection-reason"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="What happened…"
                  rows={3}
                />
              </div>
            )}

            {error && (
              <p className="text-xs text-[var(--danger)]">{error}</p>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </form>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  );
}
