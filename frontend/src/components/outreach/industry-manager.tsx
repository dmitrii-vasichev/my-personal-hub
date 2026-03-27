"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [driveFileId, setDriveFileId] = useState(industry?.drive_file_id ?? "");
  const [description, setDescription] = useState(industry?.description ?? "");
  const [errors, setErrors] = useState<{ name?: string; slug?: string }>({});

  const isLoading = createIndustry.isPending || updateIndustry.isPending;

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
          drive_file_id: driveFileId.trim() || undefined,
          description: description.trim() || undefined,
        });
      } else if (industry) {
        await updateIndustry.mutateAsync({
          id: industry.id,
          data: {
            name: name.trim(),
            slug: slug.trim(),
            drive_file_id: driveFileId.trim() || null,
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
              <Label
                htmlFor="ind-drive"
                className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide"
              >
                Google Drive File ID
              </Label>
              <Input
                id="ind-drive"
                value={driveFileId}
                onChange={(e) => setDriveFileId(e.target.value)}
                placeholder="Google Drive Markdown file ID for template"
              />
              <p className="text-xs text-[var(--text-tertiary)]">
                Markdown template used for proposal generation
              </p>
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

// ── Industry Manager ───────────────────────────────────────────────────────

export function IndustryManager() {
  const { data: industries = [], isLoading } = useIndustries();
  const deleteIndustry = useDeleteIndustry();

  const [formOpen, setFormOpen] = useState(false);
  const [editingIndustry, setEditingIndustry] = useState<Industry | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<Industry | null>(null);

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
          Manage industries and link Google Drive templates for proposal generation.
        </p>
        <Button size="sm" onClick={handleCreate} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Add Industry
        </Button>
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
                  Template
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
                    {ind.drive_file_id ? (
                      <span className="inline-flex items-center gap-1 text-xs text-[var(--accent-teal)]">
                        <FileText className="h-3.5 w-3.5" />
                        Linked
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--text-tertiary)]">
                        Not linked
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
