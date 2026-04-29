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
  useCompletedActions,
  useRestoreAction,
} from "@/hooks/use-actions";
import type { Action } from "@/types/action";

function CompletedRow({ action }: { action: Action }) {
  const restore = useRestoreAction();

  const handleRestore = () => {
    restore.mutate(action.id, {
      onSuccess: () => toast.success("Action restored"),
      onError: () => toast.error("Failed to restore"),
    });
  };

  return (
    <div className="flex items-center gap-3 border-[1.5px] border-[color:var(--line)] bg-[color:var(--bg-2)] px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[color:var(--ink)]">
          {action.title}
        </p>
        <p className="text-xs text-[color:var(--ink-3)]">
          {action.completed_at
            ? `Completed ${format(parseISO(action.completed_at), "MMM d, h:mm a")}`
            : `Done`}
        </p>
      </div>
      <Tooltip content="Restore">
        <Button
          variant="ghost"
          size="icon-sm"
          className="max-md:size-11"
          onClick={handleRestore}
          disabled={restore.isPending}
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </Tooltip>
    </div>
  );
}

export function CompletedActionsSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: completed = [], isLoading } = useCompletedActions();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup className="fixed !inset-y-0 !right-0 !left-auto !top-0 !translate-x-0 !translate-y-0 !rounded-none w-full max-w-md h-full flex flex-col border-l-[1.5px] border-[color:var(--line)] bg-[color:var(--bg)] transition-all data-[starting-style]:translate-x-full data-[ending-style]:translate-x-full md:max-w-lg">
          <div className="flex items-center justify-between border-b border-[color:var(--line)] px-6 py-4">
            <DialogTitle>Completed actions</DialogTitle>
            <DialogClose />
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-14 animate-pulse border-[1.5px] border-[color:var(--line)] bg-[color:var(--bg-2)]"
                  />
                ))}
              </div>
            ) : completed.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <div className="flex h-12 w-12 items-center justify-center border-[1.5px] border-[color:var(--line)] bg-[color:var(--bg-2)]">
                  <Archive className="h-5 w-5 text-[color:var(--ink-3)]" />
                </div>
                <p className="text-sm text-[color:var(--ink-3)]">
                  No completed actions yet
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {completed.map((action) => (
                  <CompletedRow key={action.id} action={action} />
                ))}
              </div>
            )}
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  );
}
