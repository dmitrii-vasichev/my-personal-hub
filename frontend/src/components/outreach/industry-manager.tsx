"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Download, Upload, Check, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogPopup,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  useIndustries,
  useCreateIndustry,
  useUpdateIndustry,
  useDeleteIndustry,
  useExportIndustryCases,
  useImportIndustryCases,
  useGenerateIndustryInstructions,
} from "@/hooks/use-leads";
import type { Industry } from "@/types/lead";

// ── Industry form dialog ───────────────────────────────────────────────────

interface IndustryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  industry?: Industry;
  onSuccess?: () => void;
}

function IndustryFormDialog({
  open,
  onOpenChange,
  mode,
  industry,
  onSuccess,
}: IndustryFormDialogProps) {
  const createIndustry = useCreateIndustry();
  const updateIndustry = useUpdateIndustry();

  const [name, setName] = useState(industry?.name ?? "");
  const [slug, setSlug] = useState(industry?.slug ?? "");
  const [promptInstructions, setPromptInstructions] = useState(industry?.prompt_instructions ?? "");
  const [description, setDescription] = useState(industry?.description ?? "");
  const [errors, setErrors] = useState<{ name?: string; slug?: string; generate?: string }>({});
  const [language, setLanguage] = useState("Russian");

  const generateInstructions = useGenerateIndustryInstructions();
  const isLoading = createIndustry.isPending || updateIndustry.isPending || generateInstructions.isPending;

  const autoSlug = (val: string) =>
    val
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  const handleNameChange = (val: string) => {
    setName(val);
    if (mode === "create" || slug === autoSlug(industry?.name ?? "")) {
      setSlug(autoSlug(val));
    }
    if (errors.name) setErrors((e) => ({ ...e, name: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: typeof errors = {};
    if (!name.trim()) newErrors.name = "Name is required";
    if (!slug.trim()) newErrors.slug = "Slug is required";
    if (Object.keys(newErrors).length) {
      setErrors(newErrors);
      return;
    }

    try {
      if (mode === "create") {
        await createIndustry.mutateAsync({
          name: name.trim(),
          slug: slug.trim(),
          prompt_instructions: promptInstructions.trim() || undefined,
          description: description.trim() || undefined,
        });
      } else if (industry) {
        await updateIndustry.mutateAsync({
          id: industry.id,
          data: {
            name: name.trim(),
            slug: slug.trim(),
            prompt_instructions: promptInstructions.trim() || null,
            description: description.trim() || null,
          },
        });
      }
      onSuccess?.();
    } catch (err) {
      setErrors({
        name: err instanceof Error ? err.message : "Something went wrong",
      });
    }
  };

  const handleGenerate = async () => {
    if (!industry) return; // Need an existing industry ID to generate
    try {
      const updatedIndustry = await generateInstructions.mutateAsync({
        id: industry.id,
        language: language,
      });
      if (updatedIndustry.prompt_instructions) {
        setPromptInstructions(updatedIndustry.prompt_instructions);
      }
    } catch (err) {
      setErrors({
        generate: err instanceof Error ? err.message : "Generation failed",
      });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => !isLoading && onOpenChange(isOpen)}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup className="w-full max-w-md p-6">
          <DialogClose />
          <DialogTitle className="mb-5">
            {mode === "create" ? "Add Industry" : "Edit Industry"}
          </DialogTitle>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="ind-name"
                className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide"
              >
                Name *
              </Label>
              <Input
                id="ind-name"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. Dental Services"
                autoFocus
              />
              {errors.name && (
                <p className="text-xs text-[var(--danger)]">{errors.name}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="ind-slug"
                className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide"
              >
                Slug *
              </Label>
              <Input
                id="ind-slug"
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value);
                  if (errors.slug) setErrors((er) => ({ ...er, slug: undefined }));
                }}
                placeholder="dental-services"
              />
              {errors.slug && (
                <p className="text-xs text-[var(--danger)]">{errors.slug}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="ind-prompt"
                  className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide"
                >
                  Prompt Instructions (Cases)
                </Label>
                {mode === "edit" && industry && (
                  <div className="flex items-center gap-2">
                    <Select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="h-7 w-[100px] text-xs py-0 pl-2 pr-6"
                      disabled={isLoading}
                    >
                      <option value="Russian">🇷🇺 RU</option>
                      <option value="English">🇺🇸 EN</option>
                    </Select>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1.5 text-xs text-[var(--accent-teal)] border-[var(--accent-teal)] hover:bg-[var(--accent-teal-transparent)]"
                      onClick={handleGenerate}
                      disabled={isLoading}
                    >
                      <Wand2 className="h-3.5 w-3.5" />
                      {generateInstructions.isPending ? "Generating..." : "Generate AI-Cases"}
                    </Button>
                  </div>
                )}
              </div>
              <Textarea
                id="ind-prompt"
                value={promptInstructions}
                onChange={(e) => setPromptInstructions(e.target.value)}
                placeholder="Instructions or cases for this industry..."
                rows={6}
                disabled={generateInstructions.isPending}
              />
              {mode === "create" && (
                <p className="text-xs text-[var(--text-tertiary)] italic">
                  Save this industry first to unlock AI-generation.
                </p>
              )}
              {errors.generate && (
                <p className="text-xs text-[var(--danger)]">{errors.generate}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="ind-desc"
                className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide"
              >
                Description
              </Label>
              <Textarea
                id="ind-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of this industry category..."
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading
                  ? mode === "create"
                    ? "Adding..."
                    : "Saving..."
                  : mode === "create"
                    ? "Add Industry"
                    : "Save Changes"}
              </Button>
            </div>
          </form>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  );
}

// ── Import Dialog ──────────────────────────────────────────────────────────

function ImportCasesDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const importCases = useImportIndustryCases();
  const [content, setContent] = useState("");
  const [result, setResult] = useState<{ matched: number; updated: number } | null>(null);

  const handleImport = async () => {
    if (!content.trim()) return;
    try {
      const res = await importCases.mutateAsync({ markdown_content: content });
      setResult({ matched: res.matched_count, updated: res.updated_count });
    } catch (e) {}
  };

  const handleClose = () => {
    onOpenChange(false);
    setContent("");
    setResult(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup className="w-full max-w-2xl p-6">
          <DialogClose />
          <DialogTitle className="mb-5">Import Industry Cases</DialogTitle>
          {result ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--success-muted)] text-[var(--success)]">
                <Check className="h-6 w-6" />
              </div>
              <div className="text-center">
                <p className="font-medium text-[var(--text-primary)]">Import Successful</p>
                <p className="text-sm text-[var(--text-secondary)] mt-1">
                  Matched {result.matched} industries and updated {result.updated} of them.
                </p>
              </div>
              <Button onClick={handleClose} className="mt-4">Done</Button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-[var(--text-secondary)]">
                Paste the markdown file here. Headers (# Industry Name) should match your existing industries.
              </p>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="# Industry Name&#10;Instructions here..."
                rows={12}
                className="font-mono text-xs"
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={handleClose} disabled={importCases.isPending}>
                  Cancel
                </Button>
                <Button onClick={handleImport} disabled={!content.trim() || importCases.isPending}>
                  {importCases.isPending ? "Importing..." : "Import"}
                </Button>
              </div>
            </div>
          )}
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  );
}

// ── Industry Manager ───────────────────────────────────────────────────────

export function IndustryManager() {
  const { data: industries = [], isLoading } = useIndustries();
  const deleteIndustry = useDeleteIndustry();

  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingIndustry, setEditingIndustry] = useState<Industry | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<Industry | null>(null);

  const exportCases = useExportIndustryCases();

  const handleExport = async () => {
    try {
      const res = await exportCases.mutateAsync();
      const blob = new Blob([res.markdown], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `industry-cases.md`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    }
  };

  const handleEdit = (industry: Industry) => {
    setEditingIndustry(industry);
    setFormOpen(true);
  };

  const handleCreate = () => {
    setEditingIndustry(undefined);
    setFormOpen(true);
  };

  const handleFormSuccess = () => {
    setFormOpen(false);
    setEditingIndustry(undefined);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteIndustry.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-[var(--text-tertiary)]">
        Loading industries...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--text-secondary)]">
          Manage industries and their prompt cases.
        </p>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" className="gap-1.5" onClick={handleExport} disabled={exportCases.isPending}>
            <Download className="h-4 w-4" />
            {exportCases.isPending ? "Exporting..." : "Export"}
          </Button>
          <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4" />
            Import
          </Button>
          <Button size="sm" onClick={handleCreate} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Add Industry
          </Button>
        </div>
      </div>

      {industries.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border)] p-8 text-center">
          <p className="text-sm text-[var(--text-tertiary)]">
            No industries yet. Add one to start mapping templates.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-secondary)]">
                <th className="px-4 py-2.5 text-left font-medium text-[var(--text-secondary)]">
                  Name
                </th>
                <th className="px-4 py-2.5 text-left font-medium text-[var(--text-secondary)]">
                  Description
                </th>
                <th className="px-4 py-2.5 text-center font-medium text-[var(--text-secondary)]">
                  Cases
                </th>
                <th className="px-4 py-2.5 text-right font-medium text-[var(--text-secondary)]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {industries.map((ind) => (
                <tr
                  key={ind.id}
                  className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)]"
                >
                  <td className="px-4 py-3 font-medium text-[var(--text-primary)]">
                    {ind.name}
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)] max-w-[300px] truncate">
                    {ind.description || "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {ind.prompt_instructions ? (
                      <span className="inline-flex items-center gap-1 text-xs text-[var(--accent-teal)]">
                        <Check className="h-3.5 w-3.5" />
                        Provided
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--text-tertiary)]">
                        Missing
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleEdit(ind)}
                        className="rounded p-1.5 text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(ind)}
                        className="rounded p-1.5 text-[var(--text-secondary)] hover:bg-[var(--destructive-muted)] hover:text-[var(--danger)]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <IndustryFormDialog
        key={editingIndustry?.id ?? "create"}
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={editingIndustry ? "edit" : "create"}
        industry={editingIndustry}
        onSuccess={handleFormSuccess}
      />

      <ImportCasesDialog open={importOpen} onOpenChange={setImportOpen} />

      <ConfirmDialog
        open={!!deleteTarget}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        title="Delete Industry"
        description={`Delete "${deleteTarget?.name}"? Leads linked to this industry will keep their data but lose the industry reference.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleteIndustry.isPending}
      />
    </div>
  );
}
