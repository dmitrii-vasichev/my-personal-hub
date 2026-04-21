"use client";

import { useState } from "react";
import { StartFocusDialog } from "./start-focus-dialog";

interface StartFocusButtonProps {
  taskId?: number | null;
  planItemId?: number | null;
  className?: string;
}

export function StartFocusButton({
  taskId,
  planItemId,
  className,
}: StartFocusButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label="Start focus session"
        onClick={() => setOpen(true)}
        className={`size-7 max-md:size-11 inline-flex items-center justify-center border border-[color:var(--line)] text-[color:var(--accent)] hover:border-[color:var(--accent)] transition-colors font-mono text-xs ${className ?? ""}`}
      >
        ▶
      </button>
      <StartFocusDialog
        open={open}
        onOpenChange={setOpen}
        taskId={taskId}
        planItemId={planItemId}
      />
    </>
  );
}
