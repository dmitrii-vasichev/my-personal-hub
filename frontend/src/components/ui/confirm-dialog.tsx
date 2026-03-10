"use client";

import { useEffect, useCallback } from "react";
import {
  Dialog,
  DialogPortal,
  DialogBackdrop,
  DialogPopup,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ConfirmDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "danger";
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onConfirm,
  onCancel,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  loading = false,
}: ConfirmDialogProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!open || loading) return;
      if (e.key === "Enter") {
        e.preventDefault();
        onConfirm();
      }
    },
    [open, loading, onConfirm]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onCancel()}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup className="w-full max-w-sm p-6">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="mt-2">{description}</DialogDescription>
          <div className="mt-5 flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              disabled={loading}
            >
              {cancelLabel}
            </Button>
            <Button
              size="sm"
              onClick={onConfirm}
              disabled={loading}
              className={
                variant === "danger"
                  ? "bg-[var(--danger)] text-white hover:bg-[var(--danger)]/80 border-transparent"
                  : undefined
              }
            >
              {loading ? "..." : confirmLabel}
            </Button>
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  );
}
