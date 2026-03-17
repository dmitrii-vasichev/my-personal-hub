"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Copy, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  usePulseSettings,
  useUpdatePulseSettings,
  usePulsePromptDefaults,
} from "@/hooks/use-pulse-settings";

const MAX_CHARS = 5000;

type PromptCategory = "news" | "jobs" | "learning";

interface PromptEditorProps {
  category: PromptCategory;
}

type SubTab = "custom" | "default";

const FIELD_MAP: Record<PromptCategory, "prompt_news" | "prompt_jobs" | "prompt_learning"> = {
  news: "prompt_news",
  jobs: "prompt_jobs",
  learning: "prompt_learning",
};

export function PromptEditor({ category }: PromptEditorProps) {
  const { data: settings } = usePulseSettings();
  const { data: defaults } = usePulsePromptDefaults();
  const updateSettings = useUpdatePulseSettings();

  const [subTab, setSubTab] = useState<SubTab>("custom");
  const [draft, setDraft] = useState<string>("");
  const [hasUnsaved, setHasUnsaved] = useState(false);

  const field = FIELD_MAP[category];
  const savedPrompt = settings?.[field] ?? null;
  const defaultPrompt = defaults?.[category] ?? "";

  // Sync draft with saved value when settings load or category changes
  useEffect(() => {
    setDraft(savedPrompt ?? "");
    setHasUnsaved(false);
  }, [savedPrompt, category]);

  const handleDraftChange = (value: string) => {
    if (value.length <= MAX_CHARS) {
      setDraft(value);
      setHasUnsaved(value !== (savedPrompt ?? ""));
    }
  };

  const handleSave = () => {
    updateSettings.mutate(
      { [field]: draft || null },
      {
        onSuccess: () => {
          setHasUnsaved(false);
          toast.success("Prompt saved");
        },
      }
    );
  };

  const handleReset = () => {
    updateSettings.mutate(
      { [field]: null },
      {
        onSuccess: () => {
          setDraft("");
          setHasUnsaved(false);
          toast.success("Prompt reset to default");
        },
      }
    );
  };

  const handleCopyDefault = () => {
    setDraft(defaultPrompt);
    setHasUnsaved(defaultPrompt !== (savedPrompt ?? ""));
    setSubTab("custom");
  };

  return (
    <div data-testid="prompt-editor">
      {/* Sub-tabs */}
      <div className="flex gap-1 mb-4" data-testid="prompt-sub-tabs">
        {(["custom", "default"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setSubTab(tab)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer capitalize",
              subTab === tab
                ? "bg-surface-hover text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab}
          </button>
        ))}
        {hasUnsaved && (
          <span className="ml-2 self-center text-xs text-warning">Unsaved changes</span>
        )}
      </div>

      {/* Custom tab */}
      {subTab === "custom" && (
        <div data-testid="custom-tab">
          {savedPrompt === null && draft === "" ? (
            <div className="rounded-xl border border-border bg-surface p-8 text-center">
              <p className="text-muted-foreground mb-4">
                Using default prompt for this category.
              </p>
              <Button size="sm" variant="outline" onClick={handleCopyDefault}>
                <Copy className="mr-1.5 h-4 w-4" />
                Copy default to start customizing
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <textarea
                data-testid="prompt-textarea"
                value={draft}
                onChange={(e) => handleDraftChange(e.target.value)}
                className="w-full min-h-[300px] resize-y rounded-lg border border-border bg-background p-4 text-sm text-foreground font-mono focus:outline-none focus:border-accent transition-colors"
                placeholder="Enter your custom prompt..."
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground" data-testid="char-count">
                  {draft.length} / {MAX_CHARS}
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleReset}
                    disabled={updateSettings.isPending}
                    className="text-danger border-danger/30 hover:bg-danger/10"
                    data-testid="reset-button"
                  >
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                    Reset to default
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={updateSettings.isPending || !hasUnsaved}
                    data-testid="save-button"
                  >
                    {updateSettings.isPending ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Default tab */}
      {subTab === "default" && (
        <div data-testid="default-tab">
          <div className="rounded-xl border border-border bg-surface p-1">
            <pre className="whitespace-pre-wrap text-sm text-muted-foreground font-mono p-4 max-h-[500px] overflow-y-auto">
              {defaultPrompt || "Loading default prompt..."}
            </pre>
          </div>
          <div className="mt-3 flex justify-end">
            <Button size="sm" variant="outline" onClick={handleCopyDefault}>
              <Copy className="mr-1.5 h-4 w-4" />
              Copy to custom
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
