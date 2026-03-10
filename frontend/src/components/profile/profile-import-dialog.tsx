"use client";

import { useState } from "react";
import { Upload, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogBackdrop,
  DialogPopup,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useImportProfile } from "@/hooks/use-user-profile";

interface ProfileImportDialogProps {
  onSuccess?: () => void;
}

export function ProfileImportDialog({ onSuccess }: ProfileImportDialogProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const importProfile = useImportProfile();

  const handleImport = async () => {
    if (!text.trim()) return;
    setError("");
    try {
      await importProfile.mutateAsync({ text });
      setText("");
      setOpen(false);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setText("");
          setError("");
        }
      }}
    >
      <DialogTrigger
        render={
          <Button size="sm" variant="outline">
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            Import from text
          </Button>
        }
      />
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup className="w-full max-w-lg p-6">
          <DialogClose />
          <DialogTitle>Import Profile from Text</DialogTitle>
          <DialogDescription className="mt-1">
            Paste your LinkedIn profile, resume text, or any professional
            summary. AI will parse it into structured profile data.
          </DialogDescription>

          <div className="mt-4 space-y-3">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste your resume text, LinkedIn export, or professional bio here..."
              rows={10}
              className="text-sm"
            />

            {error && (
              <p className="text-sm text-[var(--danger)]">{error}</p>
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
                disabled={importProfile.isPending}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleImport}
                disabled={!text.trim() || importProfile.isPending}
              >
                {importProfile.isPending ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Parsing...
                  </>
                ) : (
                  <>
                    <Upload className="mr-1.5 h-3.5 w-3.5" />
                    Import
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  );
}
