"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectPopup,
  SelectItem,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogPopup,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";
import { useChangeJobStatus } from "@/hooks/use-jobs";
import {
  APPLICATION_STATUS_COLORS,
  APPLICATION_STATUS_LABELS,
} from "@/types/job";
import type { ApplicationStatus } from "@/types/job";

const ALL_STATUSES: ApplicationStatus[] = [
  "found",
  "saved",
  "resume_generated",
  "applied",
  "screening",
  "technical_interview",
  "final_interview",
  "offer",
  "accepted",
  "rejected",
  "ghosted",
  "withdrawn",
];

const STATUS_LABELS_MAP: Record<string, string> = Object.fromEntries(
  ALL_STATUSES.map((s) => [s, APPLICATION_STATUS_LABELS[s]])
);

interface StatusChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: number;
  currentStatus: ApplicationStatus;
  /** Pre-select a target status (e.g. when triggered by drag-and-drop). */
  preselectedStatus?: ApplicationStatus;
  onSuccess?: () => void;
  /** Called when the user cancels the dialog (no mutation fired). */
  onCancel?: () => void;
}

export function StatusChangeDialog({
  open,
  onOpenChange,
  jobId,
  currentStatus,
  preselectedStatus,
  onSuccess,
  onCancel,
}: StatusChangeDialogProps) {
  const changeStatus = useChangeJobStatus();

  const [newStatus, setNewStatus] = useState<ApplicationStatus>(
    preselectedStatus ?? currentStatus
  );
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Sync newStatus when props change (React-recommended "adjust state during render" pattern)
  const [prevStatusKey, setPrevStatusKey] = useState(`${preselectedStatus}-${currentStatus}`);
  const statusKey = `${preselectedStatus}-${currentStatus}`;
  if (statusKey !== prevStatusKey) {
    setPrevStatusKey(statusKey);
    setNewStatus(preselectedStatus ?? currentStatus);
  }

  const isLoading = changeStatus.isPending;
  const currentColor = APPLICATION_STATUS_COLORS[currentStatus];
  const currentLabel = APPLICATION_STATUS_LABELS[currentStatus];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newStatus === currentStatus) {
      onOpenChange(false);
      return;
    }

    try {
      await changeStatus.mutateAsync({
        id: jobId,
        data: {
          new_status: newStatus,
          comment: comment.trim() || undefined,
        },
      });
      onSuccess?.();
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update status";
      setError(message);
      toast.error(message);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isLoading) {
      if (!isOpen) {
        setNewStatus(preselectedStatus ?? currentStatus);
        setComment("");
        setError(null);
        onCancel?.();
      }
      onOpenChange(isOpen);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup className="w-full max-w-md p-6">
          <DialogClose />

          <DialogTitle className="mb-5">Change Status</DialogTitle>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Current status */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)]">
                Current Status
              </span>
              <span
                className="inline-flex w-fit items-center rounded px-2.5 py-1 text-xs font-medium"
                style={{
                  color: currentColor,
                  backgroundColor: `${currentColor}18`,
                }}
              >
                {currentLabel}
              </span>
            </div>

            {/* New status select */}
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="status-select"
                className="text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)]"
              >
                New Status
              </Label>
              <SelectRoot
                value={newStatus}
                onValueChange={(value) => setNewStatus(value as ApplicationStatus)}
                disabled={isLoading}
                labels={STATUS_LABELS_MAP}
              >
                <SelectTrigger id="status-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectPopup>
                  {ALL_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {APPLICATION_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </SelectRoot>
            </div>

            {/* Optional comment */}
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="status-comment"
                className="text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)]"
              >
                Note{" "}
                <span className="normal-case font-normal text-[var(--text-tertiary)]">
                  (optional)
                </span>
              </Label>
              <Textarea
                id="status-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add a note about this change..."
                rows={3}
                disabled={isLoading}
              />
            </div>

            {error && (
              <p className="text-xs text-[var(--danger)]">{error}</p>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                onClick={() => handleOpenChange(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Updating…" : "Change Status"}
              </Button>
            </div>
          </form>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  );
}
