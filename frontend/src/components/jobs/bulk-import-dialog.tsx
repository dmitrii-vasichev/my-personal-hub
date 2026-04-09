"use client";

import { useState } from "react";
import { Upload, Check, X, AlertTriangle, Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogPopup,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";
import { useBulkImportJobs } from "@/hooks/use-jobs";
import type { BulkImportItemResult, BulkImportResponse } from "@/types/job";

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_CONFIG: Record<
  BulkImportItemResult["status"],
  { icon: typeof Check; label: string; color: string }
> = {
  created: { icon: Check, label: "Created", color: "var(--accent-teal)" },
  skipped: { icon: X, label: "Skipped", color: "var(--text-tertiary)" },
  duplicate: { icon: Copy, label: "Duplicate", color: "var(--accent-amber)" },
  failed: { icon: AlertTriangle, label: "Failed", color: "var(--destructive)" },
};

export function BulkImportDialog({ open, onOpenChange }: BulkImportDialogProps) {
  const [urlsText, setUrlsText] = useState("");
  const [result, setResult] = useState<BulkImportResponse | null>(null);
  const bulkImport = useBulkImportJobs();

  const urlCount = urlsText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean).length;

  const handleImport = async () => {
    const urls = urlsText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (urls.length === 0) return;

    const res = await bulkImport.mutateAsync(urls);
    setResult(res);
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      // Reset state on close, but delay to avoid flash
      setTimeout(() => {
        setUrlsText("");
        setResult(null);
        bulkImport.reset();
      }, 200);
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup className="w-[95vw] max-w-lg p-5">
          <DialogClose />
          <DialogTitle>Import from LinkedIn</DialogTitle>

          {!result ? (
            // Input phase
            <div className="mt-4 flex flex-col gap-3">
              <p className="text-sm text-[var(--text-secondary)]">
                Paste LinkedIn job URLs, one per line. Each job will be
                auto-fetched and matched.
              </p>
              <textarea
                value={urlsText}
                onChange={(e) => setUrlsText(e.target.value)}
                placeholder={"https://www.linkedin.com/jobs/view/123456\nhttps://www.linkedin.com/jobs/view/789012\n..."}
                rows={8}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)] focus:outline-none resize-y font-mono"
                disabled={bulkImport.isPending}
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--text-tertiary)]">
                  {urlCount > 0 ? `${urlCount} URL${urlCount !== 1 ? "s" : ""}` : "No URLs"}
                </span>
                <Button
                  size="sm"
                  onClick={handleImport}
                  disabled={urlCount === 0 || bulkImport.isPending}
                  className="gap-1.5"
                >
                  {bulkImport.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Import {urlCount > 0 && urlCount}
                    </>
                  )}
                </Button>
              </div>
              {bulkImport.isError && (
                <p className="text-sm text-[var(--destructive)]">
                  {(bulkImport.error as Error).message}
                </p>
              )}
            </div>
          ) : (
            // Results phase
            <div className="mt-4 flex flex-col gap-3">
              {/* Summary */}
              <div className="flex gap-4 text-sm">
                {result.created > 0 && (
                  <span style={{ color: "var(--accent-teal)" }}>
                    {result.created} created
                  </span>
                )}
                {result.duplicates > 0 && (
                  <span style={{ color: "var(--accent-amber)" }}>
                    {result.duplicates} duplicate{result.duplicates !== 1 && "s"}
                  </span>
                )}
                {result.skipped > 0 && (
                  <span className="text-[var(--text-tertiary)]">
                    {result.skipped} skipped
                  </span>
                )}
                {result.failed > 0 && (
                  <span style={{ color: "var(--destructive)" }}>
                    {result.failed} failed
                  </span>
                )}
              </div>

              {/* Results list */}
              <div className="max-h-64 overflow-auto rounded-lg border border-[var(--border)] divide-y divide-[var(--border)]">
                {result.results.map((item, i) => {
                  const cfg = STATUS_CONFIG[item.status];
                  const Icon = cfg.icon;
                  return (
                    <div
                      key={i}
                      className="flex items-start gap-2.5 px-3 py-2 text-sm"
                    >
                      <Icon
                        className="mt-0.5 h-4 w-4 shrink-0"
                        style={{ color: cfg.color }}
                      />
                      <div className="min-w-0 flex-1">
                        {item.title ? (
                          <div>
                            <span className="font-medium text-[var(--text-primary)]">
                              {item.title}
                            </span>
                            {item.company && (
                              <span className="text-[var(--text-secondary)]">
                                {" "}at {item.company}
                              </span>
                            )}
                            {item.match_score != null && (
                              <span
                                className="ml-2 text-xs font-medium"
                                style={{
                                  color:
                                    item.match_score >= 80
                                      ? "var(--accent-teal)"
                                      : item.match_score >= 60
                                        ? "var(--accent-amber)"
                                        : "var(--text-tertiary)",
                                }}
                              >
                                {item.match_score}%
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[var(--text-tertiary)] truncate block">
                            {item.url}
                          </span>
                        )}
                        {item.error && (
                          <p className="text-xs text-[var(--text-tertiary)]">
                            {item.error}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end">
                <Button size="sm" onClick={() => handleClose(false)}>
                  Done
                </Button>
              </div>
            </div>
          )}
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  );
}
