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
import { useUpdateApplication } from "@/hooks/use-applications";
import type { Application, ApplicationStatus } from "@/types/job";

const REJECTION_STATUSES: ApplicationStatus[] = ["rejected", "ghosted", "withdrawn"];

interface ApplicationEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  application: Application;
  onSuccess?: () => void;
}

export function ApplicationEditDialog({
  open,
  onOpenChange,
  application,
  onSuccess,
}: ApplicationEditDialogProps) {
  const updateApplication = useUpdateApplication();

  const [notes, setNotes] = useState(application.notes ?? "");
  const [recruiterName, setRecruiterName] = useState(application.recruiter_name ?? "");
  const [recruiterContact, setRecruiterContact] = useState(application.recruiter_contact ?? "");
  const [appliedDate, setAppliedDate] = useState(
    application.applied_date ? application.applied_date.slice(0, 10) : ""
  );
  const [nextAction, setNextAction] = useState(application.next_action ?? "");
  const [nextActionDate, setNextActionDate] = useState(
    application.next_action_date ? application.next_action_date.slice(0, 10) : ""
  );
  const [rejectionReason, setRejectionReason] = useState(application.rejection_reason ?? "");
  const [error, setError] = useState<string | null>(null);

  const showRejectionReason = REJECTION_STATUSES.includes(application.status);
  const isLoading = updateApplication.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      await updateApplication.mutateAsync({
        id: application.id,
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

          <DialogTitle className="mb-5">Edit Application</DialogTitle>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Notes */}
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="app-notes"
                className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide"
              >
                Notes
              </Label>
              <Textarea
                id="app-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes about this application…"
                rows={4}
              />
            </div>

            {/* Recruiter */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="app-recruiter-name"
                  className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide"
                >
                  Recruiter Name
                </Label>
                <Input
                  id="app-recruiter-name"
                  value={recruiterName}
                  onChange={(e) => setRecruiterName(e.target.value)}
                  placeholder="e.g. Jane Smith"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="app-recruiter-contact"
                  className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide"
                >
                  Recruiter Contact
                </Label>
                <Input
                  id="app-recruiter-contact"
                  value={recruiterContact}
                  onChange={(e) => setRecruiterContact(e.target.value)}
                  placeholder="email or phone"
                />
              </div>
            </div>

            {/* Applied Date */}
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="app-applied-date"
                className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide"
              >
                Applied Date
              </Label>
              <Input
                id="app-applied-date"
                type="date"
                value={appliedDate}
                onChange={(e) => setAppliedDate(e.target.value)}
              />
            </div>

            {/* Next Action */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="app-next-action"
                  className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide"
                >
                  Next Action
                </Label>
                <Input
                  id="app-next-action"
                  value={nextAction}
                  onChange={(e) => setNextAction(e.target.value)}
                  placeholder="e.g. Follow up email"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="app-next-action-date"
                  className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide"
                >
                  Next Action Date
                </Label>
                <Input
                  id="app-next-action-date"
                  type="date"
                  value={nextActionDate}
                  onChange={(e) => setNextActionDate(e.target.value)}
                />
              </div>
            </div>

            {/* Rejection Reason (only for rejected/ghosted/withdrawn) */}
            {showRejectionReason && (
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="app-rejection-reason"
                  className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide"
                >
                  Rejection Reason
                </Label>
                <Textarea
                  id="app-rejection-reason"
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
