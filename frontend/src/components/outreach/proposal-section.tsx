"use client";

import { useState } from "react";
import { Copy, Check, Pencil, Save, Sparkles, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectPopup,
  SelectItem,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useGenerateProposal, useUpdateLead } from "@/hooks/use-leads";
import type { Lead } from "@/types/lead";

const LANGUAGE_LABELS: Record<string, string> = {
  Russian: "🇷🇺 RU",
  English: "🇺🇸 EN",
};

interface ProposalSectionProps {
  lead: Lead;
}

export function ProposalSection({ lead }: ProposalSectionProps) {
  const generateProposal = useGenerateProposal();
  const updateLead = useUpdateLead();
  const [copied, setCopied] = useState(false);
  const [customInstructions, setCustomInstructions] = useState("");
  const [showInstructions, setShowInstructions] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [language, setLanguage] = useState("Russian");

  const hasProposal = !!lead.proposal_text;
  const isSaving = updateLead.isPending;

  const handleGenerate = () => {
    generateProposal.mutate({
      id: lead.id,
      data: {
        custom_instructions: customInstructions.trim() || undefined,
        language,
      },
    });
  };

  const handleCopy = async () => {
    const text = editing ? editText : lead.proposal_text;
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStartEdit = () => {
    setEditText(lead.proposal_text ?? "");
    setEditing(true);
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setEditText("");
  };

  const handleSaveEdit = () => {
    updateLead.mutate(
      { id: lead.id, data: { proposal_text: editText } },
      { onSuccess: () => setEditing(false) }
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-[var(--text-primary)]">
          Proposal
        </h3>
        <div className="flex items-center gap-1.5">
          {hasProposal && !editing && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleStartEdit}
              className="gap-1.5 h-7 text-xs"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
          )}
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
          {!hasProposal || showInstructions ? (
            <SelectRoot
              value={language}
              onValueChange={setLanguage}
              disabled={generateProposal.isPending}
              labels={LANGUAGE_LABELS}
            >
              <SelectTrigger className="h-7 w-[100px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectPopup>
                <SelectItem value="Russian">🇷🇺 RU</SelectItem>
                <SelectItem value="English">🇺🇸 EN</SelectItem>
              </SelectPopup>
            </SelectRoot>
          ) : null}

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
      {hasProposal && editing ? (
        <div className="flex flex-col gap-2">
          <Textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={12}
            className="text-sm leading-relaxed"
          />
          <div className="flex justify-end gap-1.5">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCancelEdit}
              disabled={isSaving}
              className="gap-1.5 h-7 text-xs"
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveEdit}
              disabled={isSaving || editText === lead.proposal_text}
              className="gap-1.5 h-7 text-xs"
            >
              <Save className="h-3.5 w-3.5" />
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      ) : hasProposal ? (
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
