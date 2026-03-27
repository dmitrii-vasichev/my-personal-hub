"use client";

import { useCallback, useState } from "react";
import {
  AlertCircle,
  Check,
  FileText,
  Loader2,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogDescription,
  DialogPopup,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";
import { useBatchCreateLeads } from "@/hooks/use-leads";
import type { ParsedLead, PdfParseError, CreateLeadInput } from "@/types/lead";

interface PdfPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leads: ParsedLead[];
  errors: PdfParseError[];
  totalPages: number;
  filename: string;
  onSaved?: () => void;
}

export function PdfPreviewDialog({
  open,
  onOpenChange,
  leads: initialLeads,
  errors,
  totalPages,
  filename,
  onSaved,
}: PdfPreviewDialogProps) {
  const batchCreate = useBatchCreateLeads();

  const [rows, setRows] = useState<ParsedLead[]>(initialLeads);
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(initialLeads.map((_, i) => i))
  );

  const selectedCount = selected.size;
  const allSelected = selectedCount === rows.length && rows.length > 0;

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(rows.map((_, i) => i)));
    }
  };

  const toggleRow = (index: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const updateField = useCallback(
    (index: number, field: keyof ParsedLead, value: string) => {
      setRows((prev) =>
        prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
      );
    },
    []
  );

  const removeRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
    setSelected((prev) => {
      const next = new Set<number>();
      for (const idx of prev) {
        if (idx < index) next.add(idx);
        else if (idx > index) next.add(idx - 1);
      }
      return next;
    });
  };

  const handleSave = async () => {
    const leadsToSave: CreateLeadInput[] = rows
      .filter((_, i) => selected.has(i))
      .map((row) => ({
        business_name: row.business_name,
        contact_person: row.contact_person || undefined,
        email: row.email || undefined,
        phone: row.phone || undefined,
        website: row.website || undefined,
        service_description: row.service_description || undefined,
        source: "pdf",
        source_detail: filename,
      }));

    if (leadsToSave.length === 0) return;

    try {
      await batchCreate.mutateAsync(leadsToSave);
      onSaved?.();
      onOpenChange(false);
    } catch {
      // error is shown via batchCreate.error
    }
  };

  const handleClose = (isOpen: boolean) => {
    if (batchCreate.isPending) return;
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup className="w-full max-w-5xl p-6 max-h-[90vh] overflow-hidden flex flex-col">
          <DialogClose />

          {/* Header */}
          <div className="mb-4">
            <DialogTitle className="mb-1">Review Extracted Leads</DialogTitle>
            <DialogDescription>
              <span className="inline-flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                {filename} — {totalPages} pages, {rows.length} leads found
              </span>
            </DialogDescription>
          </div>

          {/* Errors from parsing */}
          {errors.length > 0 && (
            <div className="flex items-start gap-2 mb-4 p-3 rounded-lg bg-[var(--accent-amber-muted)]">
              <AlertCircle className="h-4 w-4 text-[var(--accent-amber)] mt-0.5 shrink-0" />
              <p className="text-xs text-[var(--text-secondary)]">
                {errors.length} page(s) had extraction errors:{" "}
                {errors.map((e) => `p.${e.page}`).join(", ")}
              </p>
            </div>
          )}

          {/* Table */}
          {rows.length === 0 ? (
            <div className="flex flex-1 items-center justify-center py-12 text-sm text-[var(--text-tertiary)]">
              No leads were extracted from this PDF.
            </div>
          ) : (
            <div className="flex-1 overflow-auto rounded-lg border border-[var(--border)]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-[var(--surface-hover)]">
                    <th className="px-3 py-2 w-10">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleAll}
                        className="accent-[var(--primary)]"
                      />
                    </th>
                    <th className="px-2 py-2 text-left text-[10.5px] uppercase tracking-[0.5px] font-mono font-medium text-[var(--text-tertiary)]">
                      Business *
                    </th>
                    <th className="px-2 py-2 text-left text-[10.5px] uppercase tracking-[0.5px] font-mono font-medium text-[var(--text-tertiary)]">
                      Contact
                    </th>
                    <th className="px-2 py-2 text-left text-[10.5px] uppercase tracking-[0.5px] font-mono font-medium text-[var(--text-tertiary)]">
                      Email
                    </th>
                    <th className="px-2 py-2 text-left text-[10.5px] uppercase tracking-[0.5px] font-mono font-medium text-[var(--text-tertiary)]">
                      Phone
                    </th>
                    <th className="px-2 py-2 text-left text-[10.5px] uppercase tracking-[0.5px] font-mono font-medium text-[var(--text-tertiary)]">
                      Industry
                    </th>
                    <th className="px-2 py-2 text-left text-[10.5px] uppercase tracking-[0.5px] font-mono font-medium text-[var(--text-tertiary)] w-12">
                      Pg
                    </th>
                    <th className="px-2 py-2 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr
                      key={i}
                      className={`border-t border-[rgba(255,255,255,0.03)] transition-colors ${
                        selected.has(i)
                          ? "bg-[var(--surface)]"
                          : "bg-[var(--surface)] opacity-50"
                      }`}
                    >
                      <td className="px-3 py-1.5">
                        <input
                          type="checkbox"
                          checked={selected.has(i)}
                          onChange={() => toggleRow(i)}
                          className="accent-[var(--primary)]"
                        />
                      </td>
                      <td className="px-1 py-1">
                        <Input
                          value={row.business_name}
                          onChange={(e) =>
                            updateField(i, "business_name", e.target.value)
                          }
                          className="h-7 text-xs"
                        />
                      </td>
                      <td className="px-1 py-1">
                        <Input
                          value={row.contact_person ?? ""}
                          onChange={(e) =>
                            updateField(i, "contact_person", e.target.value)
                          }
                          className="h-7 text-xs"
                        />
                      </td>
                      <td className="px-1 py-1">
                        <Input
                          value={row.email ?? ""}
                          onChange={(e) =>
                            updateField(i, "email", e.target.value)
                          }
                          className="h-7 text-xs"
                        />
                      </td>
                      <td className="px-1 py-1">
                        <Input
                          value={row.phone ?? ""}
                          onChange={(e) =>
                            updateField(i, "phone", e.target.value)
                          }
                          className="h-7 text-xs"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <span className="text-xs text-[var(--text-tertiary)]">
                          {row.industry_suggestion || "—"}
                        </span>
                      </td>
                      <td className="px-2 py-1.5">
                        <span className="text-xs font-mono text-[var(--text-tertiary)]">
                          {row.page}
                        </span>
                      </td>
                      <td className="px-2 py-1.5">
                        <button
                          type="button"
                          onClick={() => removeRow(i)}
                          className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--destructive)] hover:bg-[var(--destructive-muted)] transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Error */}
          {batchCreate.isError && (
            <div className="flex items-start gap-2 mt-3 p-3 rounded-lg bg-[var(--destructive-muted)]">
              <AlertCircle className="h-4 w-4 text-[var(--destructive)] mt-0.5 shrink-0" />
              <p className="text-sm text-[var(--destructive)]">
                {batchCreate.error?.message || "Failed to save leads"}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--border)]">
            <p className="text-xs text-[var(--text-tertiary)]">
              {selectedCount} of {rows.length} leads selected
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => handleClose(false)}
                disabled={batchCreate.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={selectedCount === 0 || batchCreate.isPending}
              >
                {batchCreate.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-1.5" />
                    Save {selectedCount} Lead{selectedCount !== 1 ? "s" : ""}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  );
}
