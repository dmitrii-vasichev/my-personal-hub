"use client";

import { ExternalLink, Bookmark, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogPortal,
  DialogBackdrop,
  DialogPopup,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import type { SearchResult } from "@/types/search";

function formatSalary(min: number | null, max: number | null, currency: string): string | null {
  if (!min && !max) return null;
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `From ${fmt(min)}`;
  return `Up to ${fmt(max!)}`;
}

interface SearchResultDetailProps {
  result: SearchResult | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (result: SearchResult) => void;
  saved: boolean;
}

export function SearchResultDetail({ result, open, onOpenChange, onSave, saved }: SearchResultDetailProps) {
  if (!result) return null;

  const salary = formatSalary(result.salary_min, result.salary_max, result.salary_currency);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup className="w-[90vw] max-w-[640px] max-h-[85vh] flex flex-col p-0">
          <DialogClose />

          {/* Header */}
          <div className="p-5 pb-3 border-b border-[var(--border)]">
            <DialogTitle className="text-base font-semibold text-[var(--text-primary)] pr-8">
              {result.title}
            </DialogTitle>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              {result.company}
              {result.location && <span> · {result.location}</span>}
            </p>
            {salary && (
              <p className="text-sm font-medium text-[var(--success)] mt-2">{salary}</p>
            )}
            <span className="inline-block mt-2 rounded px-1.5 py-0.5 text-[10px] font-medium border border-[var(--border)] text-[var(--text-tertiary)] uppercase tracking-wide">
              {result.source}
            </span>
          </div>

          {/* Body — scrollable */}
          <div className="flex-1 overflow-y-auto p-5">
            {result.description ? (
              <p className="text-sm text-[var(--text-secondary)] whitespace-pre-line leading-relaxed">
                {result.description}
              </p>
            ) : (
              <p className="text-sm text-[var(--text-tertiary)] italic">No description available</p>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-[var(--border)] flex items-center justify-end gap-2">
            {result.url && (
              <a
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="secondary" size="sm" className="gap-1.5">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open Original
                </Button>
              </a>
            )}
            <Button
              size="sm"
              variant={saved ? "ghost" : "default"}
              disabled={saved}
              onClick={() => onSave(result)}
              className="gap-1.5"
            >
              {saved ? (
                <>
                  <CheckCircle className="h-3.5 w-3.5" />
                  Saved
                </>
              ) : (
                <>
                  <Bookmark className="h-3.5 w-3.5" />
                  Save to Jobs
                </>
              )}
            </Button>
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  );
}
