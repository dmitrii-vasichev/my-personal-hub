"use client";

import { useState } from "react";
import {
  Dialog,
  DialogPortal,
  DialogBackdrop,
  DialogPopup,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { useStartFocusMutation } from "@/hooks/use-focus-session";
import type { PlannedMinutes } from "@/types/focus-session";

interface StartFocusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId?: number | null;
  actionId?: number | null;
  planItemId?: number | null;
}

const PRESETS: PlannedMinutes[] = [25, 50, 90];

export function StartFocusDialog({
  open,
  onOpenChange,
  taskId,
  actionId,
  planItemId,
}: StartFocusDialogProps) {
  const start = useStartFocusMutation();
  const [pendingPreset, setPendingPreset] = useState<PlannedMinutes | null>(
    null,
  );

  async function handlePick(minutes: PlannedMinutes) {
    setPendingPreset(minutes);
    try {
      await start.mutateAsync({
        task_id: taskId ?? null,
        action_id: actionId ?? null,
        plan_item_id: planItemId ?? null,
        planned_minutes: minutes,
      });
      onOpenChange(false);
    } catch {
      // Mutation's onError surfaces the toast; keep dialog open for retry.
    } finally {
      setPendingPreset(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup className="w-full max-w-sm p-5">
          <DialogClose />
          <DialogTitle className="text-[9.5px] tracking-[2px] uppercase text-[color:var(--ink-3)] font-mono font-normal">
            FOCUS · PICK DURATION
          </DialogTitle>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {PRESETS.map((minutes) => {
              const isPending = pendingPreset === minutes;
              const label = isPending ? "…" : `${minutes}M`;
              return (
                <button
                  key={minutes}
                  type="button"
                  onClick={() => handlePick(minutes)}
                  disabled={start.isPending}
                  className="border border-[color:var(--line)] hover:border-[color:var(--accent)] bg-[color:var(--bg-2)] p-3 font-mono text-sm text-[color:var(--ink)] transition-colors disabled:opacity-50"
                >
                  {label}
                </button>
              );
            })}
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  );
}
