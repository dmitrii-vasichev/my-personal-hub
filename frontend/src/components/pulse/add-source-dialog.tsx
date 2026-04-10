"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Search, Loader2 } from "lucide-react";
import { useCreatePulseSource, useResolvePulseSource } from "@/hooks/use-pulse-sources";
import { SOURCE_CATEGORIES } from "@/types/pulse-source";
import type { PulseSourceResolveResult } from "@/types/pulse-source";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectPopup,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogPortal,
  DialogBackdrop,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";

const CATEGORY_LABELS_MAP: Record<string, string> = {
  ...Object.fromEntries(SOURCE_CATEGORIES.map((cat) => [cat, cat.charAt(0).toUpperCase() + cat.slice(1)])),
  custom: "Custom...",
};

interface AddSourceDialogProps {
  open: boolean;
  onClose: () => void;
}

export function AddSourceDialog({ open, onClose }: AddSourceDialogProps) {
  const createSource = useCreatePulseSource();

  const [identifier, setIdentifier] = useState("");
  const [resolveQuery, setResolveQuery] = useState("");
  const [resolved, setResolved] = useState<PulseSourceResolveResult | null>(null);
  const [category, setCategory] = useState("news");
  const [customCategory, setCustomCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [keywordsInput, setKeywordsInput] = useState("");

  const { data: resolveData, isFetching: isResolving } = useResolvePulseSource(resolveQuery);

  const reset = () => {
    setIdentifier("");
    setResolveQuery("");
    setResolved(null);
    setCategory("news");
    setCustomCategory("");
    setSubcategory("");
    setKeywordsInput("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleResolve = () => {
    if (!identifier.trim()) {
      toast.error("Enter a channel username or invite link");
      return;
    }
    setResolveQuery(identifier.trim());
  };

  // Update resolved state when data arrives
  if (resolveData && resolveData !== resolved && resolveQuery) {
    setResolved(resolveData);
    setResolveQuery("");
  }

  const handleSubmit = async () => {
    if (!resolved) {
      toast.error("Resolve a source first");
      return;
    }

    const finalCategory = category === "custom" ? customCategory.trim() : category;
    if (!finalCategory) {
      toast.error("Category is required");
      return;
    }

    const keywords = keywordsInput
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);

    try {
      await createSource.mutateAsync({
        telegram_id: resolved.telegram_id,
        username: resolved.username ?? undefined,
        title: resolved.title,
        category: finalCategory,
        subcategory: subcategory.trim() || undefined,
        keywords: keywords.length > 0 ? keywords : undefined,
      });
      handleClose();
    } catch {
      // Error handled by hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && handleClose()}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup className="w-full max-w-md p-6">
          <DialogTitle>Add Source</DialogTitle>

          <div className="mt-4 space-y-4">
            {/* Resolve input */}
            <div className="space-y-1">
              <Label className="text-xs uppercase text-muted-foreground">
                Channel Username or Invite Link
              </Label>
              <div className="flex gap-2">
                <Input
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="@channel or https://t.me/..."
                  className="flex-1 text-sm"
                  onKeyDown={(e) => e.key === "Enter" && handleResolve()}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleResolve}
                  disabled={isResolving}
                >
                  {isResolving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Resolve preview */}
            {resolved && (
              <div className="rounded-lg border border-border bg-background px-3 py-2">
                <div className="text-sm font-medium text-foreground">
                  {resolved.title}
                </div>
                <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                  {resolved.username && <span>@{resolved.username}</span>}
                  {resolved.members_count != null && (
                    <span>{resolved.members_count.toLocaleString()} members</span>
                  )}
                </div>
              </div>
            )}

            {/* Category */}
            <div className="space-y-1">
              <Label className="text-xs uppercase text-muted-foreground">Category</Label>
              <SelectRoot
                value={category}
                onValueChange={setCategory}
                labels={CATEGORY_LABELS_MAP}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectPopup>
                  {SOURCE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Custom...</SelectItem>
                </SelectPopup>
              </SelectRoot>
              {category === "custom" && (
                <Input
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder="Custom category name"
                  className="mt-1 text-sm"
                />
              )}
            </div>

            {/* Subcategory */}
            <div className="space-y-1">
              <Label className="text-xs uppercase text-muted-foreground">
                Subcategory <span className="normal-case text-muted-foreground/60">(optional)</span>
              </Label>
              <Input
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
                placeholder="e.g. Frontend, ML, etc."
                className="text-sm"
              />
            </div>

            {/* Keywords */}
            <div className="space-y-1">
              <Label className="text-xs uppercase text-muted-foreground">
                Keywords <span className="normal-case text-muted-foreground/60">(optional, comma-separated)</span>
              </Label>
              <Input
                value={keywordsInput}
                onChange={(e) => setKeywordsInput(e.target.value)}
                placeholder="python, react, ai"
                className="text-sm"
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!resolved || createSource.isPending}
            >
              {createSource.isPending ? "Adding..." : "Add Source"}
            </Button>
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  );
}
