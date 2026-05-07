"use client";

import { useId, useState } from "react";
import { RefreshCw, Sparkles, Clock, ChevronDown, ChevronUp } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogDescription,
  DialogPopup,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DemoModeBadge } from "@/components/ui/demo-mode-badge";
import { useAuth } from "@/lib/auth";
import type { VitalsBriefing } from "@/types/vitals";

interface BriefingCardProps {
  briefing: VitalsBriefing | null | undefined;
  isLoading: boolean;
  onGenerate: () => void;
  isGenerating: boolean;
}

export function BriefingCard({
  briefing,
  isLoading,
  onGenerate,
  isGenerating,
}: BriefingCardProps) {
  const { isDemo } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  const contentId = useId();

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border-subtle bg-card p-6" data-testid="briefing-loading">
        <div className="h-5 w-40 rounded bg-muted animate-pulse mb-4" />
        <div className="space-y-2">
          <div className="h-4 w-full rounded bg-muted animate-pulse" />
          <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
          <div className="h-4 w-5/6 rounded bg-muted animate-pulse" />
        </div>
      </div>
    );
  }

  if (!briefing) {
    return (
      <div className="rounded-xl border border-border-subtle bg-card p-6" data-testid="briefing-empty">
        <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
          <Sparkles className="h-8 w-8 text-muted-foreground opacity-40" />
          <h3 className="text-sm font-medium text-foreground">No briefing yet</h3>
          <p className="max-w-sm text-xs text-muted-foreground">
            Generate an AI-powered daily briefing that combines your health data with actions, calendar, and job hunt status.
          </p>
          {isDemo ? (
            <DemoModeBadge feature="AI Briefing" description="Not available in demo mode" compact />
          ) : (
            <Button size="sm" onClick={onGenerate} disabled={isGenerating}>
              {isGenerating && <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Generate Briefing
            </Button>
          )}
        </div>
      </div>
    );
  }

  const generatedAgo = formatDistanceToNow(new Date(briefing.generated_at), {
    addSuffix: true,
  });

  return (
    <div
      className={`rounded-xl border border-border-subtle bg-card transition-[padding] duration-200 ${
        isExpanded ? "p-6" : "p-4"
      }`}
      data-testid="briefing-card"
    >
      <div
        className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${
          isExpanded ? "mb-4" : ""
        }`}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[var(--accent-amber)]" />
          <h3 className="text-sm font-semibold text-foreground">Daily Briefing</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end sm:gap-3">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {generatedAgo}
          </span>
          {isDemo ? (
            <DemoModeBadge feature="Regenerate" description="Not available in demo mode" compact />
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={onGenerate}
              disabled={isGenerating}
              className="h-7 text-xs"
            >
              {isGenerating ? (
                <RefreshCw className="mr-1.5 h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="mr-1.5 h-3 w-3" />
              )}
              Regenerate
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsExpanded((prev) => !prev)}
            aria-expanded={isExpanded}
            aria-controls={contentId}
            className="h-7 text-xs"
          >
            {isExpanded ? (
              <ChevronUp className="mr-1.5 h-3 w-3" />
            ) : (
              <ChevronDown className="mr-1.5 h-3 w-3" />
            )}
            {isExpanded ? "Hide briefing" : "Show briefing"}
          </Button>
        </div>
      </div>

      {isExpanded && (
        <div
          id={contentId}
          className="prose prose-sm max-w-none border-t border-border-subtle pt-5 dark:prose-invert prose-headings:text-[var(--text-primary)] prose-p:text-[var(--text-secondary)] prose-a:text-[var(--accent)] prose-strong:text-[var(--text-primary)] prose-code:text-[var(--accent-teal)] prose-li:text-[var(--text-secondary)] prose-blockquote:border-[var(--accent)] prose-blockquote:text-[var(--text-secondary)]"
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {briefing.content}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}

export function BriefingDialog({
  briefing,
  isLoading,
  onGenerate,
  isGenerating,
}: BriefingCardProps) {
  const { isDemo } = useAuth();
  const [open, setOpen] = useState(false);

  const generatedAgo = briefing
    ? formatDistanceToNow(new Date(briefing.generated_at), {
        addSuffix: true,
      })
    : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            aria-label="Open briefing"
            className="h-8 text-xs"
          >
            {isLoading ? (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="mr-1.5 h-3.5 w-3.5 text-[var(--accent-amber)]" />
            )}
            Briefing
          </Button>
        }
      />

      {open && (
        <DialogPortal>
          <DialogBackdrop />
          <DialogPopup className="flex max-h-[82vh] w-[min(92vw,760px)] flex-col overflow-hidden p-0">
            <div className="border-b border-border-subtle px-5 py-4 pr-12">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <DialogTitle className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-[var(--accent-amber)]" />
                    Daily Briefing
                  </DialogTitle>
                  <DialogDescription className="mt-1">
                    {isLoading
                      ? "Loading briefing status..."
                      : generatedAgo
                        ? `Generated ${generatedAgo}`
                        : "Not generated yet"}
                  </DialogDescription>
                </div>

                {isDemo ? (
                  <DemoModeBadge
                    feature={briefing ? "Regenerate" : "AI Briefing"}
                    description="Not available in demo mode"
                    compact
                    className="self-start"
                  />
                ) : (
                  <Button
                    size="sm"
                    variant={briefing ? "outline" : "default"}
                    onClick={onGenerate}
                    disabled={isGenerating || isLoading}
                    className="h-7 text-xs sm:self-start"
                  >
                    {isGenerating ? (
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    {briefing ? "Regenerate" : "Generate Briefing"}
                  </Button>
                )}
              </div>
            </div>

            <DialogClose />

            <div className="overflow-y-auto px-5 py-5">
              {isLoading ? (
                <div className="space-y-3" data-testid="briefing-loading">
                  <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
                  <div className="h-4 w-full rounded bg-muted animate-pulse" />
                  <div className="h-4 w-5/6 rounded bg-muted animate-pulse" />
                </div>
              ) : !briefing ? (
                <div
                  className="flex min-h-[220px] flex-col items-center justify-center gap-3 text-center"
                  data-testid="briefing-empty"
                >
                  <Sparkles className="h-8 w-8 text-muted-foreground opacity-40" />
                  <h3 className="text-sm font-medium text-foreground">No briefing yet</h3>
                  <p className="max-w-sm text-xs text-muted-foreground">
                    Generate an AI-powered daily briefing that combines your health data
                    with actions, calendar, and job hunt status.
                  </p>
                </div>
              ) : (
                <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:text-[var(--text-primary)] prose-p:text-[var(--text-secondary)] prose-a:text-[var(--accent)] prose-strong:text-[var(--text-primary)] prose-code:text-[var(--accent-teal)] prose-li:text-[var(--text-secondary)] prose-blockquote:border-[var(--accent)] prose-blockquote:text-[var(--text-secondary)]">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {briefing.content}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </DialogPopup>
        </DialogPortal>
      )}
    </Dialog>
  );
}
