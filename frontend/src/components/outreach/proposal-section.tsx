"use client";

import { useState } from "react";
import { Copy, Check, Sparkles, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useGenerateProposal } from "@/hooks/use-leads";
import type { Lead } from "@/types/lead";

interface ProposalSectionProps {
  lead: Lead;
}

export function ProposalSection({ lead }: ProposalSectionProps) {
  const generateProposal = useGenerateProposal();
  const [copied, setCopied] = useState(false);
  const [customInstructions, setCustomInstructions] = useState("");
  const [showInstructions, setShowInstructions] = useState(false);

  const hasProposal = !!lead.proposal_text;

  const handleGenerate = () => {
    generateProposal.mutate({
      id: lead.id,
      data: customInstructions.trim()
        ? { custom_instructions: customInstructions.trim() }
        : undefined,
    });
  };

  const handleCopy = async () => {
    if (!lead.proposal_text) return;
    await navigator.clipboard.writeText(lead.proposal_text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-[var(--text-primary)]">
          Proposal
        </h3>
        <div className="flex items-center gap-1.5">
          {hasProposal && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCopy}
              className="gap-1.5 h-7 text-xs"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-[var(--accent-teal)]" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </>
              )}
            </Button>
          )}
          <Button
            size="sm"
            variant={hasProposal ? "ghost" : "default"}
            onClick={handleGenerate}
            disabled={generateProposal.isPending}
            className="gap-1.5 h-7 text-xs"
          >
            {generateProposal.isPending ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                Generating...
              </>
            ) : hasProposal ? (
              <>
                <RefreshCw className="h-3.5 w-3.5" />
                Regenerate
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                Generate
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Custom instructions toggle */}
      {!hasProposal || showInstructions ? (
        <div className="flex flex-col gap-1.5">
          <Textarea
            value={customInstructions}
            onChange={(e) => setCustomInstructions(e.target.value)}
            placeholder="Optional: custom instructions for the AI (e.g. focus on SEO services, mention discount...)"
            rows={2}
            className="text-xs"
          />
        </div>
      ) : (
        <button
          onClick={() => setShowInstructions(true)}
          className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] text-left"
        >
          + Add custom instructions for regeneration
        </button>
      )}

      {/* Proposal text */}
      {hasProposal ? (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] p-4">
          <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">
            {lead.proposal_text}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-[var(--border)] p-6 text-center">
          <Sparkles className="mx-auto h-5 w-5 text-[var(--text-tertiary)] mb-2" />
          <p className="text-sm text-[var(--text-tertiary)]">
            No proposal yet. Click &ldquo;Generate&rdquo; to create a personalized proposal.
          </p>
          {!lead.industry_id && (
            <p className="text-xs text-[var(--accent-amber)] mt-1">
              Tip: assign an industry with a linked template for better results.
            </p>
          )}
        </div>
      )}

      {generateProposal.isError && (
        <p className="text-xs text-[var(--danger)]">
          {generateProposal.error instanceof Error
            ? generateProposal.error.message
            : "Failed to generate proposal"}
        </p>
      )}
    </div>
  );
}
