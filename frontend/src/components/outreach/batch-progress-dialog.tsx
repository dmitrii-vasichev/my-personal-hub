"use client";

import {
  CheckCircle2,
  Circle,
  Loader2,
  Pause,
  Play,
  XCircle,
  SkipForward,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogDescription,
  DialogPopup,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useBatchJob,
  useCancelBatch,
  usePauseBatch,
  useSendBatch,
} from "@/hooks/use-leads";
import type { BatchItemStatus, BatchJobStatus } from "@/types/lead";

interface BatchProgressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: number | null;
}

const STATUS_ICONS: Record<BatchItemStatus, React.ReactNode> = {
  queued: <Circle className="h-4 w-4 text-[var(--text-tertiary)]" />,
  sending: <Loader2 className="h-4 w-4 text-[var(--accent)] animate-spin" />,
  sent: <CheckCircle2 className="h-4 w-4 text-[var(--success,#22c55e)]" />,
  failed: <XCircle className="h-4 w-4 text-[var(--destructive)]" />,
  skipped: <SkipForward className="h-4 w-4 text-[var(--text-tertiary)]" />,
};

const JOB_STATUS_LABELS: Record<BatchJobStatus, string> = {
  preparing: "Preparing",
  sending: "Sending...",
  paused: "Paused",
  completed: "Completed",
  cancelled: "Cancelled",
  failed: "Failed",
};

export function BatchProgressDialog({
  open,
  onOpenChange,
  jobId,
}: BatchProgressDialogProps) {
  const { data: job } = useBatchJob(jobId);
  const pauseBatch = usePauseBatch();
  const cancelBatch = useCancelBatch();
  const resumeBatch = useSendBatch();

  if (!job) return null;

  const isSending = job.status === "sending";
  const isPaused = job.status === "paused";
  const isDone = ["completed", "cancelled", "failed"].includes(job.status);
  const progress =
    job.total_count > 0
      ? Math.round(((job.sent_count + job.failed_count) / job.total_count) * 100)
      : 0;

  const handlePause = () => pauseBatch.mutate(job.id);
  const handleCancel = () => cancelBatch.mutate(job.id);
  const handleResume = () => {
    const items = job.items
      .filter((i) => i.status === "queued")
      .map((i) => ({
        lead_id: i.lead_id,
        included: true,
      }));
    resumeBatch.mutate({ job_id: job.id, items });
  };

  // Filter out skipped items for cleaner display
  const visibleItems = job.items.filter((i) => i.status !== "skipped");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup className="max-w-xl max-h-[80vh] overflow-hidden flex flex-col">
          <div className="p-4 border-b border-[var(--border)]">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-lg font-semibold text-[var(--text-primary)]">
                  Batch Outreach
                </DialogTitle>
                <DialogDescription className="text-sm text-[var(--text-secondary)] mt-0.5">
                  {JOB_STATUS_LABELS[job.status as BatchJobStatus]} &mdash;{" "}
                  {job.sent_count} sent, {job.failed_count} failed of{" "}
                  {job.total_count}
                </DialogDescription>
              </div>
              <DialogClose />
            </div>

            {/* Progress bar */}
            <div className="mt-3">
              <div className="h-2 rounded-full bg-[var(--muted)] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${progress}%`,
                    backgroundColor: isDone
                      ? job.status === "completed"
                        ? "var(--success, #22c55e)"
                        : "var(--destructive)"
                      : "var(--accent)",
                  }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-xs text-[var(--text-tertiary)]">{progress}%</span>
                <span className="text-xs text-[var(--text-tertiary)]">
                  {job.sent_count + job.failed_count}/{job.total_count}
                </span>
              </div>
            </div>
          </div>

          {/* Item list */}
          <div className="flex-1 overflow-auto p-4 space-y-1.5">
            {visibleItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-md bg-[var(--surface)] border border-[var(--border)]"
              >
                {STATUS_ICONS[item.status as BatchItemStatus]}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[var(--text-primary)] truncate">
                    {item.lead_business_name || `Lead #${item.lead_id}`}
                  </div>
                  <div className="text-xs text-[var(--text-tertiary)] truncate">
                    {item.subject}
                  </div>
                </div>
                {item.error_message && (
                  <span
                    className="text-xs text-[var(--destructive)] max-w-[200px] truncate"
                    title={item.error_message}
                  >
                    {item.error_message}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-4 border-t border-[var(--border)]">
            <div className="text-xs text-[var(--text-tertiary)]">
              {isSending && "Emails are sent with 2-3 min delay between each"}
              {isPaused && "Job is paused. Resume to continue sending."}
              {isDone && job.status === "completed" && "All emails sent successfully!"}
              {isDone && job.status === "cancelled" && "Job was cancelled."}
              {isDone && job.status === "failed" && "Job failed. Check errors above."}
            </div>
            <div className="flex items-center gap-2">
              {isSending && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePause}
                    disabled={pauseBatch.isPending}
                    className="gap-1.5"
                  >
                    <Pause className="h-3.5 w-3.5" />
                    Pause
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancel}
                    disabled={cancelBatch.isPending}
                    className="gap-1.5 text-[var(--destructive)]"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Cancel
                  </Button>
                </>
              )}
              {isPaused && (
                <>
                  <Button
                    size="sm"
                    onClick={handleResume}
                    disabled={resumeBatch.isPending}
                    className="gap-1.5"
                  >
                    <Play className="h-3.5 w-3.5" />
                    Resume
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancel}
                    disabled={cancelBatch.isPending}
                    className="gap-1.5 text-[var(--destructive)]"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Cancel
                  </Button>
                </>
              )}
              {isDone && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                >
                  Close
                </Button>
              )}
            </div>
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  );
}
