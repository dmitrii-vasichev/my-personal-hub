"use client";

import { format, parseISO } from "date-fns";
import { Archive, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogPortal,
  DialogBackdrop,
  DialogPopup,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import {
  useCompletedReminders,
  useRestoreReminder,
} from "@/hooks/use-reminders";
import type { Reminder } from "@/types/reminder";

function CompletedRow({ reminder }: { reminder: Reminder }) {
  const restore = useRestoreReminder();

  const handleRestore = () => {
    restore.mutate(reminder.id, {
      onSuccess: () => toast.success("Reminder restored"),
      onError: () => toast.error("Failed to restore"),
    });
  };

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {reminder.title}
        </p>
        <p className="text-xs text-muted-foreground">
          {reminder.completed_at
            ? `Completed ${format(parseISO(reminder.completed_at), "MMM d, h:mm a")}`
            : `Done`}
        </p>
      </div>
      <Tooltip content="Restore">
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={handleRestore}
          disabled={restore.isPending}
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </Tooltip>
    </div>
  );
}

export function CompletedRemindersSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: completed = [], isLoading } = useCompletedReminders();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup className="fixed !inset-y-0 !right-0 !left-auto !top-0 !translate-x-0 !translate-y-0 !rounded-none !rounded-l-2xl w-full max-w-md h-full flex flex-col border-l border-border transition-all data-[starting-style]:translate-x-full data-[ending-style]:translate-x-full md:max-w-lg">
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <DialogTitle>Completed reminders</DialogTitle>
            <DialogClose />
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-14 animate-pulse rounded-lg border border-border bg-card"
                  />
                ))}
              </div>
            ) : completed.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted border border-border">
                  <Archive className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">
                  No completed reminders yet
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {completed.map((r) => (
                  <CompletedRow key={r.id} reminder={r} />
                ))}
              </div>
            )}
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  );
}
