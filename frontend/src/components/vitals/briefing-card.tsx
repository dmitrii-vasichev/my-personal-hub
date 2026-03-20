"use client";

import { RefreshCw, Sparkles, Clock } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
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
            Generate an AI-powered daily briefing that combines your health data with tasks, calendar, and job hunt status.
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
    <div className="rounded-xl border border-border-subtle bg-card p-6" data-testid="briefing-card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[var(--accent-amber)]" />
          <h3 className="text-sm font-semibold text-foreground">Daily Briefing</h3>
        </div>
        <div className="flex items-center gap-3">
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
        </div>
      </div>

      <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:text-[var(--text-primary)] prose-p:text-[var(--text-secondary)] prose-a:text-[var(--accent)] prose-strong:text-[var(--text-primary)] prose-code:text-[var(--accent-teal)] prose-li:text-[var(--text-secondary)] prose-blockquote:border-[var(--accent)] prose-blockquote:text-[var(--text-secondary)]">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {briefing.content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
