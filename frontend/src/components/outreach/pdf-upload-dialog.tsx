"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, FileText, AlertCircle, Loader2 } from "lucide-react";
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
import { useParsePdf } from "@/hooks/use-leads";
import type { PdfParseResponse } from "@/types/lead";

interface PdfUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onParsed: (result: PdfParseResponse, filename: string) => void;
}

export function PdfUploadDialog({
  open,
  onOpenChange,
  onParsed,
}: PdfUploadDialogProps) {
  const parsePdf = useParsePdf();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setSelectedFile(null);
    setError(null);
    parsePdf.reset();
  };

  const handleClose = (isOpen: boolean) => {
    if (parsePdf.isPending) return;
    if (!isOpen) reset();
    onOpenChange(isOpen);
  };

  const handleFileSelect = (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Only PDF files are accepted");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setError("File is too large (max 50 MB)");
      return;
    }
    setError(null);
    setSelectedFile(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, []);

  const handleParse = async () => {
    if (!selectedFile) return;
    setError(null);

    try {
      const result = await parsePdf.mutateAsync(selectedFile);
      onParsed(result, selectedFile.name);
      handleClose(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "PDF parsing failed";
      if (message === "Failed to fetch") {
        setError(
          "Connection lost — the PDF may be too large. Try a file with fewer pages.",
        );
      } else {
        setError(message);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup className="w-full max-w-md p-6">
          <DialogClose />

          <DialogTitle className="mb-1">Upload PDF</DialogTitle>
          <DialogDescription className="mb-5">
            Upload a Russian-language newspaper or magazine PDF to extract
            business contacts.
          </DialogDescription>

          {/* Drop zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed
              p-8 cursor-pointer transition-colors
              ${
                dragOver
                  ? "border-[var(--primary)] bg-[var(--accent-muted)]"
                  : selectedFile
                    ? "border-[var(--primary)] bg-[var(--accent-muted)]"
                    : "border-[var(--border)] hover:border-[var(--text-tertiary)] hover:bg-[var(--surface-hover)]"
              }
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(file);
                e.target.value = "";
              }}
            />

            {selectedFile ? (
              <>
                <FileText className="h-8 w-8 text-[var(--primary)]" />
                <div className="text-center">
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    {selectedFile.name}
                  </p>
                  <p className="text-xs text-[var(--text-tertiary)] mt-1">
                    {(selectedFile.size / 1024 / 1024).toFixed(1)} MB — click to
                    change
                  </p>
                </div>
              </>
            ) : (
              <>
                <Upload className="h-8 w-8 text-[var(--text-tertiary)]" />
                <div className="text-center">
                  <p className="text-sm text-[var(--text-secondary)]">
                    Drop PDF here or click to browse
                  </p>
                  <p className="text-xs text-[var(--text-tertiary)] mt-1">
                    Max 50 MB
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Parsing progress */}
          {parsePdf.isPending && (
            <div className="flex items-center gap-2 mt-4 p-3 rounded-lg bg-[var(--accent-muted)]">
              <Loader2 className="h-4 w-4 text-[var(--primary)] animate-spin" />
              <p className="text-sm text-[var(--text-secondary)]">
                Parsing PDF with GPT-4o Vision… This may take a few minutes for
                large files.
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 mt-4 p-3 rounded-lg bg-[var(--destructive-muted)]">
              <AlertCircle className="h-4 w-4 text-[var(--destructive)] mt-0.5 shrink-0" />
              <p className="text-sm text-[var(--destructive)]">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 mt-5">
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleClose(false)}
              disabled={parsePdf.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleParse}
              disabled={!selectedFile || parsePdf.isPending}
            >
              {parsePdf.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  Parsing…
                </>
              ) : (
                "Extract Leads"
              )}
            </Button>
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  );
}
