"use client";

import { useCallback, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Check,
  FileText,
  Loader2,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogDescription,
  DialogPopup,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";
import { useBatchCreateLeads, useCheckDuplicates } from "@/hooks/use-leads";
import type { DuplicateMatch, ParsedLead, PdfParseError, CreateLeadInput } from "@/types/lead";

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
  const checkDuplicates = useCheckDuplicates();

  const [rows, setRows] = useState<ParsedLead[]>(initialLeads);
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(initialLeads.map((_, i) => i))
  );
  const [duplicateMap, setDuplicateMap] = useState<Map<number, DuplicateMatch[]>>(new Map());
  const [duplicatesChecked, setDuplicatesChecked] = useState(false);

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
    const selectedRows = rows.filter((_, i) => selected.has(i));
    if (selectedRows.length === 0) return;

    // Check for duplicates before saving (skip if already confirmed)
    if (!duplicatesChecked) {
      const emails = selectedRows.map((r) => r.email).filter(Boolean) as string[];
      const phones = selectedRows.map((r) => r.phone).filter(Boolean) as string[];

      if (emails.length > 0 || phones.length > 0) {
        try {
          const result = await checkDuplicates.mutateAsync({ emails, phones });

          if (result.duplicates.length > 0) {
            // Map duplicates to row indices
            const map = new Map<number, DuplicateMatch[]>();
            for (const dup of result.duplicates) {
              rows.forEach((row, i) => {
                if (!selected.has(i)) return;
                const isMatch =
                  (dup.field === "email" && row.email?.toLowerCase() === dup.value.toLowerCase()) ||
                  (dup.field === "phone" && row.phone?.replace(/\D/g, "") === dup.value.replace(/\D/g, ""));
                if (isMatch) {
                  const existing = map.get(i) || [];
                  existing.push(dup);
                  map.set(i, existing);
                }
              });
            }
            setDuplicateMap(map);
            return; // Stop — show warnings, user can deselect or confirm
          }
        } catch {
          // If check fails, proceed (non-blocking)
        }
      }
    }

    const leadsToSave: CreateLeadInput[] = selectedRows.map((row) => ({
      business_name: row.business_name,
      contact_person: row.contact_person || undefined,
      email: row.email || undefined,
      phone: row.phone || undefined,
      website: row.website || undefined,
      service_description: row.service_description || undefined,
      source: "pdf",
      source_detail: filename,
    }));

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
        <DialogPopup className="w-full max-w-7xl p-6 max-h-[90vh] overflow-hidden flex flex-col">
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
                      Website
                    </th>
                    <th className="px-2 py-2 text-left text-[10.5px] uppercase tracking-[0.5px] font-mono font-medium text-[var(--text-tertiary)]">
                      Description
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
                  {rows.map((row, i) => {
                    const rowDuplicates = duplicateMap.get(i);
                    return (
                    <tr
                      key={i}
                      className={`border-t border-[rgba(255,255,255,0.03)] transition-colors ${
                        rowDuplicates && selected.has(i)
                          ? "bg-[var(--accent-amber-muted)]"
                          : selected.has(i)
                            ? "bg-[var(--surface)]"
                            : "bg-[var(--surface)] opacity-50"
                      }`}
                    >
                      <td className="px-3 py-1.5">
                        <div className="flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={selected.has(i)}
                            onChange={() => toggleRow(i)}
                            className="accent-[var(--primary)]"
                          />
                          {rowDuplicates && (
                            <span title={rowDuplicates.map((d) => `${d.field}: ${d.existing_business_name}`).join(", ")}>
                              <AlertTriangle className="h-3.5 w-3.5 text-[var(--accent-amber)]" />
                            </span>
                          )}
                        </div>
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
                      <td className="px-1 py-1">
                        <Input
                          value={row.website ?? ""}
                          onChange={(e) =>
                            updateField(i, "website", e.target.value)
                          }
                          placeholder="example.com"
                          className="h-7 text-xs"
                        />
                      </td>
                      <td className="px-1 py-1">
                        <Tooltip content={row.service_description ?? ""} side="top" delay={0} portal={false}>
                          <Input
                            value={row.service_description ?? ""}
                            onChange={(e) =>
                              updateField(i, "service_description", e.target.value)
                            }
                            className="h-7 text-xs"
                          />
                        </Tooltip>
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
                    );
                  })}
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

          {/* Duplicate Warning Banner */}
          {duplicateMap.size > 0 && !duplicatesChecked && (
            <div className="flex items-start gap-2 mt-3 p-3 rounded-lg bg-[var(--accent-amber-muted)] border border-[var(--accent-amber)]/30">
              <AlertTriangle className="h-4 w-4 text-[var(--accent-amber)] mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  {duplicateMap.size} lead{duplicateMap.size !== 1 ? "s" : ""} may already exist
                </p>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Deselect duplicates or save anyway.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setDuplicatesChecked(true);
                  setDuplicateMap(new Map());
                  handleSave();
                }}
              >
                Save Anyway
              </Button>
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
                disabled={selectedCount === 0 || batchCreate.isPending || checkDuplicates.isPending}
              >
                {batchCreate.isPending || checkDuplicates.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                    {checkDuplicates.isPending ? "Checking…" : "Saving…"}
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
