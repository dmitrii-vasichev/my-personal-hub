"use client";

import { useState, KeyboardEvent } from "react";
import { X, Download } from "lucide-react";
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
import { useCreateJob, useUpdateJob } from "@/hooks/use-jobs";
import { api } from "@/lib/api";
import type { Job } from "@/types/job";

interface JobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  job?: Job;
  onSuccess?: () => void;
}

export function JobDialog({ open, onOpenChange, mode, job, onSuccess }: JobDialogProps) {
  const createJob = useCreateJob();
  const updateJob = useUpdateJob();

  const [title, setTitle] = useState(job?.title ?? "");
  const [company, setCompany] = useState(job?.company ?? "");
  const [location, setLocation] = useState(job?.location ?? "");
  const [url, setUrl] = useState(job?.url ?? "");
  const [description, setDescription] = useState(job?.description ?? "");
  const [salaryMin, setSalaryMin] = useState(job?.salary_min?.toString() ?? "");
  const [salaryMax, setSalaryMax] = useState(job?.salary_max?.toString() ?? "");
  const [salaryCurrency, setSalaryCurrency] = useState(job?.salary_currency ?? "USD");
  const [salaryPeriod, setSalaryPeriod] = useState(job?.salary_period ?? "yearly");
  const [tags, setTags] = useState<string[]>(job?.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [matchScore, setMatchScore] = useState(
    job?.match_score !== undefined && job.match_score !== null
      ? job.match_score.toString()
      : ""
  );
  const [errors, setErrors] = useState<{ title?: string; company?: string }>({});
  const [isFetchingDesc, setIsFetchingDesc] = useState(false);

  const isLoading = createJob.isPending || updateJob.isPending;

  const handleFetchDescription = async () => {
    if (!url.trim()) return;
    setIsFetchingDesc(true);
    try {
      const result = await api.post<{ title: string; company: string; location: string; description: string }>("/api/jobs/fetch-description", { url: url.trim() });
      if (result.title && !title.trim()) setTitle(result.title);
      if (result.company && !company.trim()) setCompany(result.company);
      if (result.location && !location.trim()) setLocation(result.location);
      if (result.description) setDescription(result.description);
    } catch (err) {
      setErrors((prev) => ({ ...prev, title: err instanceof Error ? err.message : "Failed to fetch description" }));
    } finally {
      setIsFetchingDesc(false);
    }
  };

  const addTag = (value: string) => {
    const trimmed = value.trim().replace(/,+$/, "").trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags((prev) => [...prev, trimmed]);
    }
    setTagInput("");
  };

  const handleTagKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(tagInput);
    } else if (e.key === "Backspace" && tagInput === "" && tags.length > 0) {
      setTags((prev) => prev.slice(0, -1));
    }
  };

  const removeTag = (tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: { title?: string; company?: string } = {};
    if (!title.trim()) newErrors.title = "Title is required";
    if (!company.trim()) newErrors.company = "Company is required";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});

    // Flush any pending tag input
    if (tagInput.trim()) {
      addTag(tagInput);
    }

    const salaryMinNum = salaryMin ? parseInt(salaryMin, 10) : undefined;
    const salaryMaxNum = salaryMax ? parseInt(salaryMax, 10) : undefined;
    const matchScoreNum = matchScore ? parseInt(matchScore, 10) : undefined;

    try {
      if (mode === "create") {
        await createJob.mutateAsync({
          title: title.trim(),
          company: company.trim(),
          location: location.trim() || undefined,
          url: url.trim() || undefined,
          description: description.trim() || undefined,
          salary_min: salaryMinNum,
          salary_max: salaryMaxNum,
          salary_currency: salaryCurrency.trim() || "USD",
          salary_period: salaryPeriod,
          match_score: matchScoreNum,
          tags: tags.length > 0 ? tags : undefined,
        });
      } else if (job) {
        await updateJob.mutateAsync({
          id: job.id,
          data: {
            title: title.trim(),
            company: company.trim(),
            location: location.trim() || null,
            url: url.trim() || null,
            description: description.trim() || null,
            salary_min: salaryMinNum ?? null,
            salary_max: salaryMaxNum ?? null,
            salary_currency: salaryCurrency.trim() || "USD",
            salary_period: salaryPeriod,
            match_score: matchScoreNum ?? null,
            tags,
          },
        });
      }
      onSuccess?.();
    } catch (err) {
      setErrors({
        title: err instanceof Error ? err.message : "Something went wrong",
      });
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isLoading) onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup className="w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
          <DialogClose />

          <DialogTitle className="mb-5">
            {mode === "create" ? "Add Job" : "Edit Job"}
          </DialogTitle>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Title */}
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="job-title"
                className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide"
              >
                Title *
              </Label>
              <Input
                id="job-title"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }));
                }}
                placeholder="e.g. Senior Frontend Engineer"
                autoFocus
              />
              {errors.title && (
                <p className="text-xs text-[var(--danger)]">{errors.title}</p>
              )}
            </div>

            {/* Company */}
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="job-company"
                className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide"
              >
                Company *
              </Label>
              <Input
                id="job-company"
                value={company}
                onChange={(e) => {
                  setCompany(e.target.value);
                  if (errors.company) setErrors((prev) => ({ ...prev, company: undefined }));
                }}
                placeholder="e.g. Acme Corp"
              />
              {errors.company && (
                <p className="text-xs text-[var(--danger)]">{errors.company}</p>
              )}
            </div>

            {/* Location + URL */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="job-location"
                  className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide"
                >
                  Location
                </Label>
                <Input
                  id="job-location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Remote, NYC"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="job-url"
                    className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide"
                  >
                    URL
                  </Label>
                  {url.trim() && (
                    <button
                      type="button"
                      onClick={handleFetchDescription}
                      disabled={isFetchingDesc}
                      className="flex items-center gap-1 text-xs text-[var(--accent-foreground)] hover:underline disabled:opacity-50"
                    >
                      <Download className="h-3 w-3" />
                      {isFetchingDesc ? "Fetching…" : "Fetch from URL"}
                    </button>
                  )}
                </div>
                <Input
                  id="job-url"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
            </div>

            {/* Description */}
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="job-description"
                className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide"
              >
                Description
              </Label>
              <Textarea
                id="job-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Job description, requirements…"
                rows={4}
              />
            </div>

            {/* Salary */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">
                  Salary
                </Label>
                <div className="flex rounded-md border border-[var(--border)] overflow-hidden">
                  {(["yearly", "hourly"] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setSalaryPeriod(p)}
                      className={`px-2.5 py-1 text-[11px] font-medium transition-colors ${
                        salaryPeriod === p
                          ? "bg-[var(--accent)] text-white"
                          : "bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
                      }`}
                    >
                      {p === "yearly" ? "/yr" : "/hr"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="job-salary-min"
                    className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide"
                  >
                    Min
                  </Label>
                  <Input
                    id="job-salary-min"
                    type="number"
                    min={0}
                    value={salaryMin}
                    onChange={(e) => setSalaryMin(e.target.value)}
                    placeholder={salaryPeriod === "hourly" ? "45" : "60000"}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="job-salary-max"
                    className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide"
                  >
                    Max
                  </Label>
                  <Input
                    id="job-salary-max"
                    type="number"
                    min={0}
                    value={salaryMax}
                    onChange={(e) => setSalaryMax(e.target.value)}
                    placeholder={salaryPeriod === "hourly" ? "65" : "100000"}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="job-salary-currency"
                    className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide"
                  >
                    Currency
                  </Label>
                  <Input
                    id="job-salary-currency"
                    value={salaryCurrency}
                    onChange={(e) => setSalaryCurrency(e.target.value)}
                    placeholder="USD"
                    maxLength={5}
                  />
                </div>
              </div>
            </div>

            {/* Tags */}
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="job-tags"
                className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide"
              >
                Tags
              </Label>
              <div className="flex flex-wrap gap-1.5 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 focus-within:border-[var(--accent)] transition-colors min-h-[36px]">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="flex items-center gap-1 rounded bg-[var(--surface-hover)] border border-[var(--border)] px-1.5 py-0.5 text-[11px] text-[var(--text-secondary)]"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                      aria-label={`Remove tag ${tag}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <input
                  id="job-tags"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  onBlur={() => { if (tagInput.trim()) addTag(tagInput); }}
                  placeholder={tags.length === 0 ? "Type and press Enter or comma…" : ""}
                  className="flex-1 min-w-[140px] bg-transparent text-xs text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none"
                />
              </div>
              <p className="text-[11px] text-[var(--text-tertiary)]">
                Press Enter or comma to add a tag
              </p>
            </div>

            {/* Match Score */}
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="job-match-score"
                className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide"
              >
                Match Score (0–100)
              </Label>
              <Input
                id="job-match-score"
                type="number"
                min={0}
                max={100}
                value={matchScore}
                onChange={(e) => setMatchScore(e.target.value)}
                placeholder="e.g. 85"
                className="w-32"
              />
            </div>

            {/* Actions */}
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
                    ? "Adding…"
                    : "Saving…"
                  : mode === "create"
                    ? "Add Job"
                    : "Save Changes"}
              </Button>
            </div>
          </form>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  );
}
