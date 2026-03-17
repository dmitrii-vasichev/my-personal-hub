"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { CATEGORY_LABELS } from "@/types/pulse-source";
import { PromptEditor } from "@/components/pulse/prompt-editor";

type PromptCategory = "news" | "jobs" | "learning";

const TABS: { id: PromptCategory; label: string }[] = Object.entries(CATEGORY_LABELS).map(
  ([id, label]) => ({ id: id as PromptCategory, label })
);

export default function PulsePromptsPage() {
  const [category, setCategory] = useState<PromptCategory>("news");

  return (
    <div className="mx-auto max-w-5xl px-6 py-6 animate-[fadeIn_0.4s_ease_both]">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/pulse"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Pulse
        </Link>
        <h1 className="text-xl font-semibold text-foreground">Digest Prompts</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Customize the AI prompts used for digest generation
        </p>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 mb-6" data-testid="prompt-category-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setCategory(tab.id)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer",
              category === tab.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-surface-hover hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Prompt editor */}
      <PromptEditor category={category} />
    </div>
  );
}
