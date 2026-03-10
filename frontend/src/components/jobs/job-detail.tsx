"use client";

import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Briefcase,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  DollarSign,
  ExternalLink,
  Mail,
  MapPin,
  Pencil,
  Plus,
  Tag,
  Trash2,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatusChangeDialog } from "@/components/jobs/status-change-dialog";
import { JobTrackingEditDialog } from "@/components/jobs/job-tracking-edit-dialog";
import { JobMatchSection } from "@/components/jobs/job-match-section";
import { LinkedTasksSection } from "@/components/jobs/linked-tasks-section";
import { LinkedEventsSection } from "@/components/jobs/linked-events-section";
import { ResumeSection } from "@/components/jobs/resume-section";
import { CoverLetterSection } from "@/components/jobs/cover-letter-section";
import { ApplicationTimeline } from "@/components/jobs/application-timeline";
import { useDeleteJob, useUpdateJob, useChangeJobStatus, useStatusHistory } from "@/hooks/use-jobs";
import { APPLICATION_STATUS_LABELS, APPLICATION_STATUS_COLORS, APPLICATION_STATUS_BG_COLORS } from "@/types/job";
import type { Job, UpdateJobInput } from "@/types/job";

interface JobDetailProps {
  job: Job;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatSalary(min?: number, max?: number, currency = "USD"): string | null {
  if (!min && !max) return null;
  const fmt = (n: number) =>
    `${currency} ${n >= 1000 ? `${(n / 1000).toFixed(0)}k` : n.toLocaleString()}`;
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `from ${fmt(min)}`;
  return `up to ${fmt(max!)}`;
}

const REJECTION_STATUSES = ["rejected", "ghosted", "withdrawn"] as const;

const COLLAPSED_MAX_HEIGHT = 96;

// --- Inline Edit Components ---

function InlineEditText({
  value,
  onSave,
  className = "",
  inputClassName = "",
  placeholder = "Empty",
  type = "text",
}: {
  value: string;
  onSave: (v: string) => Promise<void>;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
  type?: "text" | "number" | "url";
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => { if (editing) { inputRef.current?.focus(); inputRef.current?.select(); } }, [editing]);

  const save = useCallback(async () => {
    if (draft === value) { setEditing(false); return; }
    setSaving(true);
    try { await onSave(draft); setEditing(false); } catch { /* keep editing */ } finally { setSaving(false); }
  }, [draft, value, onSave]);

  const cancel = useCallback(() => { setDraft(value); setEditing(false); }, [value]);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); cancel(); }
    else if (e.key === "Enter") { e.preventDefault(); save(); }
  };

  if (editing) {
    return (
      <span className={`inline-flex items-center gap-1 ${className}`}>
        <input
          ref={inputRef}
          type={type}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={save}
          disabled={saving}
          placeholder={placeholder}
          className={`rounded border border-[var(--accent)] bg-[var(--background)] px-1.5 py-0.5 outline-none ring-1 ring-[var(--accent)]/30 text-[var(--text-primary)] ${inputClassName}`}
        />
      </span>
    );
  }

  return (
    <span
      className={`group/ie inline-flex items-center gap-1 cursor-pointer ${className}`}
      onClick={() => setEditing(true)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") setEditing(true); }}
    >
      <span className={value ? "" : "text-[var(--text-tertiary)] italic"}>
        {value || placeholder}
      </span>
      <Pencil className="h-3 w-3 shrink-0 text-[var(--text-tertiary)] opacity-0 group-hover/ie:opacity-100 transition-opacity" />
    </span>
  );
}

function InlineEditTags({
  tags,
  onSave,
}: {
  tags: string[];
  onSave: (tags: string[]) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string[]>(tags);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(tags); }, [tags]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const addTag = (val: string) => {
    const t = val.trim().replace(/,+$/, "").trim();
    if (t && !draft.includes(t)) setDraft((prev) => [...prev, t]);
    setInput("");
  };

  const removeTag = (tag: string) => setDraft((prev) => prev.filter((t) => t !== tag));

  const save = useCallback(async () => {
    if (input.trim()) addTag(input);
    setSaving(true);
    try { await onSave(draft); setEditing(false); } catch { /* keep editing */ } finally { setSaving(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, input, onSave]);

  const cancel = useCallback(() => { setDraft(tags); setInput(""); setEditing(false); }, [tags]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(input); }
    else if (e.key === "Backspace" && input === "" && draft.length > 0) setDraft((prev) => prev.slice(0, -1));
    else if (e.key === "Escape") { e.preventDefault(); cancel(); }
  };

  if (editing) {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap gap-1.5 rounded-md border border-[var(--accent)] bg-[var(--background)] px-2 py-1.5 ring-1 ring-[var(--accent)]/30 min-h-[32px]">
          {draft.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-1 rounded bg-[var(--surface-hover)] border border-[var(--border)] px-1.5 py-0.5 text-[11px] text-[var(--text-secondary)]"
            >
              {tag}
              <button type="button" onClick={() => removeTag(tag)} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={draft.length === 0 ? "Type and press Enter…" : ""}
            className="flex-1 min-w-[100px] bg-transparent text-xs text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none"
            disabled={saving}
          />
        </div>
        <div className="flex gap-1">
          <button onClick={save} disabled={saving} className="rounded p-1 text-[var(--success)] hover:bg-[var(--surface-hover)] transition-colors" title="Save">
            <Check className="h-3.5 w-3.5" />
          </button>
          <button onClick={cancel} disabled={saving} className="rounded p-1 text-[var(--text-tertiary)] hover:bg-[var(--surface-hover)] transition-colors" title="Cancel">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="group/ie flex items-center gap-1.5 flex-wrap cursor-pointer"
      onClick={() => setEditing(true)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") setEditing(true); }}
    >
      <Tag className="h-3 w-3 text-[var(--text-tertiary)] shrink-0" />
      {tags.length > 0 ? (
        tags.map((tag) => (
          <span
            key={tag}
            className="px-1.5 py-0.5 rounded text-[11px] bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-secondary)]"
          >
            {tag}
          </span>
        ))
      ) : (
        <span className="text-[var(--text-tertiary)] italic text-xs">No tags</span>
      )}
      <Pencil className="h-3 w-3 shrink-0 text-[var(--text-tertiary)] opacity-0 group-hover/ie:opacity-100 transition-opacity" />
    </div>
  );
}

// --- Collapsible Description ---

function CollapsibleDescription({
  description,
  onSave,
}: {
  description: string;
  onSave: (v: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [needsCollapse, setNeedsCollapse] = useState(false);
  const [fullHeight, setFullHeight] = useState<number>(0);
  const contentRef = useRef<HTMLDivElement>(null);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(description);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setDraft(description); }, [description]);
  useEffect(() => {
    if (contentRef.current) {
      const h = contentRef.current.scrollHeight;
      setFullHeight(h);
      setNeedsCollapse(h > COLLAPSED_MAX_HEIGHT);
    }
  }, [description]);
  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(textareaRef.current.value.length, textareaRef.current.value.length);
    }
  }, [editing]);

  const save = useCallback(async () => {
    if (draft === description) { setEditing(false); return; }
    setSaving(true);
    try { await onSave(draft); setEditing(false); } catch { /* keep editing */ } finally { setSaving(false); }
  }, [draft, description, onSave]);

  const cancel = useCallback(() => { setDraft(description); setEditing(false); }, [description]);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); cancel(); }
    else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); save(); }
  };

  if (editing) {
    return (
      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
          Description
        </h3>
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={saving}
          rows={10}
          className="w-full rounded-md border border-[var(--accent)] bg-[var(--background)] px-2.5 py-2 text-sm leading-relaxed text-[var(--text-primary)] outline-none ring-1 ring-[var(--accent)]/30 resize-y"
          placeholder="Job description…"
        />
        <div className="flex items-center gap-1 mt-1.5">
          <button onClick={save} disabled={saving} className="rounded p-1 text-[var(--success)] hover:bg-[var(--surface-hover)] transition-colors" title="Save (Cmd+Enter)">
            <Check className="h-3.5 w-3.5" />
          </button>
          <button onClick={cancel} disabled={saving} className="rounded p-1 text-[var(--text-tertiary)] hover:bg-[var(--surface-hover)] transition-colors" title="Cancel (Esc)">
            <X className="h-3.5 w-3.5" />
          </button>
          <span className="text-[10px] text-[var(--text-tertiary)] ml-1">Cmd+Enter to save, Esc to cancel</span>
        </div>
      </div>
    );
  }

  return (
    <div className="group/desc">
      <div className="flex items-center gap-1.5 mb-2">
        <h3 className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
          Description
        </h3>
        <button
          onClick={() => setEditing(true)}
          className="rounded p-0.5 text-[var(--text-tertiary)] opacity-0 group-hover/desc:opacity-100 hover:bg-[var(--surface-hover)] transition-all"
          title="Edit description"
        >
          <Pencil className="h-3 w-3" />
        </button>
      </div>
      <div className="relative">
        <div
          ref={contentRef}
          className="overflow-hidden transition-[max-height] duration-300 ease-in-out"
          style={{
            maxHeight: !needsCollapse || expanded ? fullHeight || "none" : COLLAPSED_MAX_HEIGHT,
          }}
        >
          <p className="text-sm leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap">
            {description}
          </p>
        </div>
        {needsCollapse && !expanded && (
          <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-[var(--bg)] to-transparent pointer-events-none" />
        )}
      </div>
      {needsCollapse && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-1.5 flex items-center gap-1 text-xs text-[var(--accent-foreground)] hover:text-[var(--accent-hover)] transition-colors"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" />
              Show more
            </>
          )}
        </button>
      )}
    </div>
  );
}

// --- Inline Salary Edit ---

function InlineEditSalary({
  min,
  max,
  currency,
  onSave,
}: {
  min?: number;
  max?: number;
  currency: string;
  onSave: (data: { salary_min: number | null; salary_max: number | null; salary_currency: string }) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draftMin, setDraftMin] = useState(min?.toString() ?? "");
  const [draftMax, setDraftMax] = useState(max?.toString() ?? "");
  const [draftCurrency, setDraftCurrency] = useState(currency);
  const [saving, setSaving] = useState(false);
  const minRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraftMin(min?.toString() ?? "");
    setDraftMax(max?.toString() ?? "");
    setDraftCurrency(currency);
  }, [min, max, currency]);

  useEffect(() => { if (editing) minRef.current?.focus(); }, [editing]);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      await onSave({
        salary_min: draftMin ? parseInt(draftMin, 10) : null,
        salary_max: draftMax ? parseInt(draftMax, 10) : null,
        salary_currency: draftCurrency || "USD",
      });
      setEditing(false);
    } catch { /* keep editing */ } finally { setSaving(false); }
  }, [draftMin, draftMax, draftCurrency, onSave]);

  const cancel = useCallback(() => {
    setDraftMin(min?.toString() ?? "");
    setDraftMax(max?.toString() ?? "");
    setDraftCurrency(currency);
    setEditing(false);
  }, [min, max, currency]);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); cancel(); }
    else if (e.key === "Enter") { e.preventDefault(); save(); }
  };

  const formatted = formatSalary(min, max, currency);

  if (editing) {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="grid grid-cols-3 gap-1.5">
          <input
            ref={minRef}
            type="number"
            value={draftMin}
            onChange={(e) => setDraftMin(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Min"
            disabled={saving}
            className="w-full rounded border border-[var(--accent)] bg-[var(--background)] px-1.5 py-0.5 text-xs text-[var(--text-primary)] outline-none ring-1 ring-[var(--accent)]/30"
          />
          <input
            type="number"
            value={draftMax}
            onChange={(e) => setDraftMax(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Max"
            disabled={saving}
            className="w-full rounded border border-[var(--accent)] bg-[var(--background)] px-1.5 py-0.5 text-xs text-[var(--text-primary)] outline-none ring-1 ring-[var(--accent)]/30"
          />
          <input
            type="text"
            value={draftCurrency}
            onChange={(e) => setDraftCurrency(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="USD"
            maxLength={5}
            disabled={saving}
            className="w-full rounded border border-[var(--accent)] bg-[var(--background)] px-1.5 py-0.5 text-xs text-[var(--text-primary)] outline-none ring-1 ring-[var(--accent)]/30"
          />
        </div>
        <div className="flex gap-1">
          <button onClick={save} disabled={saving} className="rounded p-1 text-[var(--success)] hover:bg-[var(--surface-hover)] transition-colors" title="Save">
            <Check className="h-3.5 w-3.5" />
          </button>
          <button onClick={cancel} disabled={saving} className="rounded p-1 text-[var(--text-tertiary)] hover:bg-[var(--surface-hover)] transition-colors" title="Cancel">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="group/ie flex items-center gap-1.5 text-sm text-[var(--text-primary)] cursor-pointer"
      onClick={() => setEditing(true)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") setEditing(true); }}
    >
      <DollarSign className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
      <span className={formatted ? "" : "text-[var(--text-tertiary)] italic"}>{formatted ?? "Not set"}</span>
      <Pencil className="h-3 w-3 shrink-0 text-[var(--text-tertiary)] opacity-0 group-hover/ie:opacity-100 transition-opacity" />
    </div>
  );
}

// --- Main Component ---

export function JobDetail({ job }: JobDetailProps) {
  const router = useRouter();
  const deleteJob = useDeleteJob();
  const updateJob = useUpdateJob();
  const changeJobStatus = useChangeJobStatus();
  const { data: history = [] } = useStatusHistory(job.id);
  const [trackingEditOpen, setTrackingEditOpen] = useState(false);
  const [isStartingTracking, setIsStartingTracking] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);

  const hasStatus = !!job.status;
  const showRejectionReason =
    hasStatus && (REJECTION_STATUSES as readonly string[]).includes(job.status!) && !!job.rejection_reason;

  const patchJob = useCallback(
    async (data: UpdateJobInput) => {
      await updateJob.mutateAsync({ id: job.id, data });
      toast.success("Updated");
    },
    [job.id, updateJob]
  );

  const handleDelete = async () => {
    if (!confirm(`Delete "${job.title}" at ${job.company}? This action cannot be undone.`)) return;
    await deleteJob.mutateAsync(job.id);
    router.push("/jobs");
  };

  const handleStartTracking = async () => {
    setIsStartingTracking(true);
    try {
      await changeJobStatus.mutateAsync({
        id: job.id,
        data: { new_status: "found" },
      });
      toast.success("Tracking started");
    } catch {
      // Stay on page if tracking fails
    } finally {
      setIsStartingTracking(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      {/* Top bar */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <button
          onClick={() => router.push("/jobs")}
          className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Jobs
        </button>
        <Button
          variant="destructive"
          size="sm"
          onClick={handleDelete}
          disabled={deleteJob.isPending}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </Button>
      </div>

      {/* Page header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-mono text-xs text-[var(--text-tertiary)]">JOB-{job.id}</span>
          {job.match_score !== undefined && job.match_score !== null && (
            <span
              className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${
                job.match_score >= 80
                  ? "bg-[#0f2d22] text-[#34d399]"
                  : job.match_score >= 60
                  ? "bg-[#2a2510] text-[#fbbf24]"
                  : "bg-[var(--surface-hover)] text-[var(--text-tertiary)]"
              }`}
            >
              {job.match_score}% match
            </span>
          )}
        </div>
        <h1 className="text-2xl font-semibold text-[var(--text-primary)] leading-tight">
          <InlineEditText
            value={job.title}
            onSave={(v) => patchJob({ title: v.trim() || job.title })}
            inputClassName="text-2xl font-semibold w-full"
            placeholder="Job title"
          />
        </h1>
        <div className="flex items-center gap-1.5 mt-1">
          <Briefcase className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
          <InlineEditText
            value={job.company}
            onSave={(v) => patchJob({ company: v.trim() || job.company })}
            className="text-sm text-[var(--text-secondary)]"
            inputClassName="text-sm"
            placeholder="Company"
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        {/* Main content */}
        <div className="flex flex-col gap-6">
          {/* Description */}
          {job.description ? (
            <CollapsibleDescription
              description={job.description}
              onSave={(v) => patchJob({ description: v.trim() || null })}
            />
          ) : (
            <div className="group/desc">
              <div className="flex items-center gap-1.5 mb-2">
                <h3 className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
                  Description
                </h3>
              </div>
              <button
                onClick={() => {
                  // Trigger inline edit for empty description by providing a CollapsibleDescription with empty string
                }}
                className="text-sm text-[var(--text-tertiary)] italic flex items-center gap-1 hover:text-[var(--text-secondary)] transition-colors"
              >
                <Plus className="h-3 w-3" />
                Add description
              </button>
            </div>
          )}

          {/* AI Match Analysis */}
          <JobMatchSection job={job} />

          {/* Source URL */}
          <div className="group/url">
            <div className="flex items-center gap-1.5 mb-2">
              <h3 className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
                Job Posting
              </h3>
            </div>
            {job.url ? (
              <div className="flex items-center gap-2">
                <a
                  href={job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-semibold bg-[var(--accent-muted)] text-[var(--accent-foreground)] border border-[rgba(79,142,247,0.2)] hover:bg-[rgba(79,142,247,0.15)] transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                  View Original Posting
                </a>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(job.url!);
                    toast.success("URL copied to clipboard");
                  }}
                  className="p-1.5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
                  title="Copy URL"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <InlineEditText
                  value={job.url}
                  onSave={(v) => patchJob({ url: v.trim() || null })}
                  className="text-xs text-[var(--text-tertiary)]"
                  inputClassName="text-xs w-64"
                  placeholder="URL"
                />
              </div>
            ) : (
              <InlineEditText
                value=""
                onSave={(v) => patchJob({ url: v.trim() || null })}
                className="text-sm"
                inputClassName="text-sm"
                placeholder="Add URL"
              />
            )}
          </div>

          {/* Tags */}
          <div>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
              Tags
            </h3>
            <InlineEditTags
              tags={job.tags}
              onSave={(tags) => patchJob({ tags })}
            />
          </div>

          {/* Tracking info sections (only when tracked) */}
          {hasStatus && (
            <>
              {job.notes && (
                <div>
                  <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
                    Notes
                  </h3>
                  <p className="text-sm leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap">
                    {job.notes}
                  </p>
                </div>
              )}

              {(job.recruiter_name || job.recruiter_contact) && (
                <div>
                  <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
                    Recruiter
                  </h3>
                  <div className="flex flex-col gap-1.5">
                    {job.recruiter_name && (
                      <div className="flex items-center gap-1.5 text-sm text-[var(--text-primary)]">
                        <User className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
                        {job.recruiter_name}
                      </div>
                    )}
                    {job.recruiter_contact && (
                      <div className="flex items-center gap-1.5 text-sm text-[var(--text-primary)]">
                        <Mail className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
                        {job.recruiter_contact}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {(job.next_action || job.next_action_date) && (
                <div>
                  <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
                    Next Action
                  </h3>
                  <div className="flex flex-col gap-1">
                    {job.next_action && (
                      <p className="text-sm text-[var(--text-primary)]">{job.next_action}</p>
                    )}
                    {job.next_action_date && (
                      <div className="flex items-center gap-1.5 text-sm text-[var(--text-tertiary)]">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDate(job.next_action_date)}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {job.applied_date && (
                <div>
                  <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
                    Applied
                  </h3>
                  <div className="flex items-center gap-1.5 text-sm text-[var(--text-primary)]">
                    <Calendar className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
                    {formatDate(job.applied_date)}
                  </div>
                </div>
              )}

              {showRejectionReason && (
                <div>
                  <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
                    Rejection Reason
                  </h3>
                  <p className="text-sm leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap">
                    {job.rejection_reason}
                  </p>
                </div>
              )}
            </>
          )}

          {/* Linked Tasks */}
          <LinkedTasksSection jobId={job.id} />

          {/* Linked Events */}
          <LinkedEventsSection jobId={job.id} />

          {/* Resume section (only when tracked) */}
          {hasStatus && (
            <div className="mt-2">
              <ResumeSection jobId={job.id} />
            </div>
          )}

          {/* Cover Letter section (only when tracked) */}
          {hasStatus && (
            <div>
              <CoverLetterSection jobId={job.id} />
            </div>
          )}

          {/* Status History (only when tracked) */}
          {hasStatus && history.length > 0 && (
            <div>
              <h3 className="mb-4 text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
                Status History
              </h3>
              <ApplicationTimeline history={history} />
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-5 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 h-fit">
          {/* Tracking status section */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
              Tracking
            </span>
            {hasStatus && job.status ? (
              <div className="flex flex-col gap-2">
                <span
                  className="inline-flex w-fit items-center rounded-md px-2.5 py-1 text-xs font-medium"
                  style={{
                    color: APPLICATION_STATUS_COLORS[job.status],
                    backgroundColor: APPLICATION_STATUS_BG_COLORS[job.status],
                  }}
                >
                  {APPLICATION_STATUS_LABELS[job.status]}
                </span>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStatusDialogOpen(true)}
                  className="w-full justify-center text-xs"
                >
                  Change Status
                </Button>

                <button
                  onClick={() => setTrackingEditOpen(true)}
                  className="text-xs text-[var(--accent-foreground)] hover:text-[var(--accent-hover)] transition-colors text-center"
                >
                  Edit Tracking Info
                </button>
              </div>
            ) : (
              <Button
                size="sm"
                onClick={handleStartTracking}
                disabled={isStartingTracking}
                className="w-full justify-center text-xs bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white border-0"
              >
                {isStartingTracking ? "Starting…" : "Start Tracking"}
              </Button>
            )}
          </div>

          <div className="border-t border-[var(--border)]" />

          {/* Location */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
              Location
            </span>
            <div className="flex items-center gap-1.5 text-sm text-[var(--text-primary)]">
              <MapPin className="h-3.5 w-3.5 text-[var(--text-tertiary)] shrink-0" />
              <InlineEditText
                value={job.location ?? ""}
                onSave={(v) => patchJob({ location: v.trim() || null })}
                className="text-sm"
                inputClassName="text-sm"
                placeholder="Add location"
              />
            </div>
          </div>

          {/* Salary */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
              Salary
            </span>
            <InlineEditSalary
              min={job.salary_min}
              max={job.salary_max}
              currency={job.salary_currency ?? "USD"}
              onSave={(data) => patchJob(data)}
            />
          </div>

          {job.source && (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
                Source
              </span>
              <span className="text-sm font-mono text-[var(--text-primary)]">{job.source}</span>
            </div>
          )}

          {job.found_at && (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
                Found
              </span>
              <div className="flex items-center gap-1.5 text-sm text-[var(--text-primary)]">
                <Calendar className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
                {formatDate(job.found_at)}
              </div>
            </div>
          )}

          <div className="border-t border-[var(--border)] pt-3 flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]">
              <Clock className="h-3 w-3" />
              Created {formatDate(job.created_at)}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]">
              <Clock className="h-3 w-3" />
              Updated {formatDate(job.updated_at)}
            </div>
          </div>
        </div>
      </div>

      {trackingEditOpen && (
        <JobTrackingEditDialog
          open={trackingEditOpen}
          onOpenChange={setTrackingEditOpen}
          job={job}
          onSuccess={() => setTrackingEditOpen(false)}
        />
      )}

      {hasStatus && job.status && statusDialogOpen && (
        <StatusChangeDialog
          open={statusDialogOpen}
          onOpenChange={setStatusDialogOpen}
          jobId={job.id}
          currentStatus={job.status}
          onSuccess={() => setStatusDialogOpen(false)}
        />
      )}
    </div>
  );
}
