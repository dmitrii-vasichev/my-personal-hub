"use client";

import { useState } from "react";
import { Wand2, Copy, Check, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCoverLetters, useGenerateCoverLetter } from "@/hooks/use-resumes";
import type { CoverLetter } from "@/types/resume";

function CoverLetterCard({ cl }: { cl: CoverLetter }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(cl.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          v{cl.version} · {new Date(cl.created_at).toLocaleDateString()}
        </span>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs gap-1"
            onClick={() => setExpanded((e) => !e)}
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? "Collapse" : "View"}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={handleCopy}>
            {copied ? <Check className="h-3 w-3 text-[var(--success)]" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="rounded border border-border bg-background p-3 text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
          {cl.content}
        </div>
      )}
    </div>
  );
}

export function CoverLetterSection({ jobId }: { jobId: number }) {
  const { data: letters = [], isLoading } = useCoverLetters(jobId);
  const generate = useGenerateCoverLetter();

  const handleGenerate = async () => {
    try {
      await generate.mutateAsync(jobId);
      toast.success("Cover letter generated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Cover Letter</h3>
        <Button size="sm" variant="secondary" onClick={handleGenerate} disabled={generate.isPending} className="gap-1.5 h-7 text-xs">
          <Wand2 className="h-3 w-3" />
          {generate.isPending ? "Generating…" : "Generate Cover Letter"}
        </Button>
      </div>

      {isLoading && <p className="text-xs text-muted-foreground">Loading…</p>}

      {!isLoading && letters.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No cover letters yet. Generate one with AI.
        </p>
      )}

      <div className="space-y-2">
        {letters.map((cl) => (
          <CoverLetterCard key={cl.id} cl={cl} />
        ))}
      </div>
    </div>
  );
}
