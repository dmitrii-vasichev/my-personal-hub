"use client";

import { useCallback, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  Send,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogDescription,
  DialogPopup,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";
import { useIndustries, usePrepareBatch, useSendBatch } from "@/hooks/use-leads";
import type {
  BatchItemPreview,
  BatchItemUpdate,
  BatchPrepareInput,
  BatchJobResponse,
  LeadStatus,
} from "@/types/lead";
import { LEAD_STATUS_LABELS } from "@/types/lead";

interface BatchPrepareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBatchStarted: (job: BatchJobResponse) => void;
}

const BATCHABLE_STATUSES: LeadStatus[] = ["new", "contacted", "follow_up"];

export function BatchPrepareDialog({
  open,
  onOpenChange,
  onBatchStarted,
}: BatchPrepareDialogProps) {
  const { data: industries = [] } = useIndustries();
  const prepareBatch = usePrepareBatch();
  const sendBatch = useSendBatch();

  // Filter state
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(["new"]);
  const [selectedIndustry, setSelectedIndustry] = useState<number | undefined>();
  const [subjectTemplate, setSubjectTemplate] = useState(
    "Коммерческое предложение — {business_name}"
  );

  // Preview state
  const [jobId, setJobId] = useState<number | null>(null);
  const [items, setItems] = useState<BatchItemPreview[]>([]);
  const [skippedNoEmail, setSkippedNoEmail] = useState(0);
  const [skippedNoProposal, setSkippedNoProposal] = useState(0);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [step, setStep] = useState<"filter" | "preview">("filter");

  const selectedCount = items.filter((i) => i.included).length;

  const handlePrepare = useCallback(async () => {
    const input: BatchPrepareInput = {
      status: selectedStatuses.length > 0 ? selectedStatuses : undefined,
      industry_id: selectedIndustry,
      subject_template: subjectTemplate,
    };

    try {
      const result = await prepareBatch.mutateAsync(input);
      setJobId(result.job_id);
      setItems(result.items);
      setSkippedNoEmail(result.skipped_no_email);
      setSkippedNoProposal(result.skipped_no_proposal);
      setStep("preview");
    } catch {
      // error handled by mutation state
    }
  }, [selectedStatuses, selectedIndustry, subjectTemplate, prepareBatch]);

  const handleToggle = (idx: number) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === idx ? { ...item, included: !item.included } : item
      )
    );
  };

  const handleToggleAll = () => {
    const allSelected = items.every((i) => i.included);
    setItems((prev) => prev.map((item) => ({ ...item, included: !allSelected })));
  };

  const handleSubjectChange = (idx: number, value: string) => {
    setItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, subject: value } : item))
    );
  };

  const handleBodyChange = (idx: number, value: string) => {
    setItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, body: value } : item))
    );
  };

  const handleSend = useCallback(async () => {
    if (!jobId) return;

    const batchItems: BatchItemUpdate[] = items.map((item) => ({
      lead_id: item.lead_id,
      subject: item.subject,
      body: item.body,
      included: item.included,
    }));

    try {
      const job = await sendBatch.mutateAsync({ job_id: jobId, items: batchItems });
      onBatchStarted(job);
      onOpenChange(false);
      // Reset state
      setStep("filter");
      setItems([]);
      setJobId(null);
    } catch {
      // error handled by mutation state
    }
  }, [jobId, items, sendBatch, onBatchStarted, onOpenChange]);

  const handleClose = (open: boolean) => {
    if (!open) {
      setStep("filter");
      setItems([]);
      setJobId(null);
      setExpandedIdx(null);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
            <div>
              <DialogTitle className="text-lg font-semibold text-[var(--text-primary)]">
                {step === "filter" ? "Prepare Batch Outreach" : "Review & Send"}
              </DialogTitle>
              <DialogDescription className="text-sm text-[var(--text-secondary)] mt-0.5">
                {step === "filter"
                  ? "Select leads to include in this batch"
                  : `${selectedCount} of ${items.length} leads selected`}
              </DialogDescription>
            </div>
            <DialogClose />
          </div>

          <div className="flex-1 overflow-auto p-4">
            {step === "filter" && (
              <div className="space-y-4">
                {/* Status filter */}
                <div>
                  <label className="text-sm font-medium text-[var(--text-primary)] mb-1.5 block">
                    Lead Statuses
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {BATCHABLE_STATUSES.map((s) => (
                      <button
                        key={s}
                        onClick={() =>
                          setSelectedStatuses((prev) =>
                            prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
                          )
                        }
                        className={`px-3 py-1.5 rounded-md text-sm transition-colors border ${
                          selectedStatuses.includes(s)
                            ? "bg-[var(--accent-muted)] border-[var(--primary)] text-[var(--primary)]"
                            : "bg-[var(--surface)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        }`}
                      >
                        {LEAD_STATUS_LABELS[s]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Industry filter */}
                <div>
                  <label className="text-sm font-medium text-[var(--text-primary)] mb-1.5 block">
                    Industry
                  </label>
                  <select
                    value={selectedIndustry ?? ""}
                    onChange={(e) =>
                      setSelectedIndustry(e.target.value ? Number(e.target.value) : undefined)
                    }
                    className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
                  >
                    <option value="">All Industries</option>
                    {industries.map((ind) => (
                      <option key={ind.id} value={ind.id}>
                        {ind.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Subject template */}
                <div>
                  <label className="text-sm font-medium text-[var(--text-primary)] mb-1.5 block">
                    Email Subject Template
                  </label>
                  <input
                    value={subjectTemplate}
                    onChange={(e) => setSubjectTemplate(e.target.value)}
                    className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
                    placeholder="Use {business_name} for business name"
                  />
                  <p className="text-xs text-[var(--text-tertiary)] mt-1">
                    {"{business_name}"} will be replaced with the lead&apos;s business name
                  </p>
                </div>

                {prepareBatch.error && (
                  <p className="text-sm text-[var(--destructive)]">
                    {(prepareBatch.error as Error).message}
                  </p>
                )}
              </div>
            )}

            {step === "preview" && (
              <div className="space-y-3">
                {/* Skipped info */}
                {(skippedNoEmail > 0 || skippedNoProposal > 0) && (
                  <div className="text-sm text-[var(--text-secondary)] bg-[var(--accent-amber-muted)] border border-[var(--accent-amber)] rounded-md px-3 py-2">
                    {skippedNoEmail > 0 && (
                      <span>Skipped {skippedNoEmail} leads without email. </span>
                    )}
                    {skippedNoProposal > 0 && (
                      <span>
                        Skipped {skippedNoProposal} leads (proposal generation failed).
                      </span>
                    )}
                  </div>
                )}

                {items.length === 0 && (
                  <div className="text-center py-8 text-[var(--text-tertiary)]">
                    No leads match the selected criteria.
                  </div>
                )}

                {items.length > 0 && (
                  <>
                    {/* Select all */}
                    <div className="flex items-center gap-2 pb-2 border-b border-[var(--border)]">
                      <input
                        type="checkbox"
                        checked={items.every((i) => i.included)}
                        onChange={handleToggleAll}
                        className="rounded"
                      />
                      <span className="text-sm text-[var(--text-secondary)]">
                        Select all ({items.length})
                      </span>
                    </div>

                    {/* Items */}
                    {items.map((item, idx) => (
                      <div
                        key={item.lead_id}
                        className={`border rounded-md transition-colors ${
                          item.included
                            ? "border-[var(--border)] bg-[var(--surface)]"
                            : "border-[var(--border)] bg-[var(--muted)] opacity-60"
                        }`}
                      >
                        {/* Item header */}
                        <div className="flex items-center gap-3 px-3 py-2.5">
                          <input
                            type="checkbox"
                            checked={item.included}
                            onChange={() => handleToggle(idx)}
                            className="rounded flex-shrink-0"
                          />
                          <button
                            onClick={() =>
                              setExpandedIdx(expandedIdx === idx ? null : idx)
                            }
                            className="flex-shrink-0 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                          >
                            {expandedIdx === idx ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm text-[var(--text-primary)] truncate">
                              {item.business_name}
                            </div>
                            <div className="text-xs text-[var(--text-tertiary)] truncate">
                              {item.email}
                              {item.industry_name && ` · ${item.industry_name}`}
                            </div>
                          </div>
                        </div>

                        {/* Expanded: edit subject & body */}
                        {expandedIdx === idx && (
                          <div className="px-3 pb-3 space-y-2 border-t border-[var(--border)]">
                            <div className="pt-2">
                              <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">
                                Subject
                              </label>
                              <input
                                value={item.subject}
                                onChange={(e) =>
                                  handleSubjectChange(idx, e.target.value)
                                }
                                className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-2.5 py-1.5 text-sm text-[var(--text-primary)]"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">
                                Body
                              </label>
                              <textarea
                                value={item.body}
                                onChange={(e) =>
                                  handleBodyChange(idx, e.target.value)
                                }
                                rows={8}
                                className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-2.5 py-1.5 text-sm text-[var(--text-primary)] resize-y"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-4 border-t border-[var(--border)]">
            {step === "filter" && (
              <>
                <div />
                <Button
                  onClick={handlePrepare}
                  disabled={prepareBatch.isPending || selectedStatuses.length === 0}
                  className="gap-1.5"
                >
                  {prepareBatch.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {prepareBatch.isPending ? "Generating proposals..." : "Prepare Batch"}
                </Button>
              </>
            )}

            {step === "preview" && (
              <>
                <Button
                  variant="outline"
                  onClick={() => setStep("filter")}
                  size="sm"
                >
                  Back
                </Button>
                <div className="flex items-center gap-2">
                  {sendBatch.error && (
                    <span className="text-sm text-[var(--destructive)]">
                      {(sendBatch.error as Error).message}
                    </span>
                  )}
                  <Button
                    onClick={handleSend}
                    disabled={sendBatch.isPending || selectedCount === 0}
                    className="gap-1.5"
                  >
                    {sendBatch.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    Send {selectedCount} Emails
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  );
}
