"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useEventJobHint } from "@/hooks/use-event-job-hint";
import { useJobs } from "@/hooks/use-jobs";

interface JobLinkSelectorProps {
  eventId: number;
  currentJobId: number | null;
  onChange: (jobId: number | null) => void;
  disabled?: boolean;
}

export function JobLinkSelector({
  eventId,
  currentJobId,
  onChange,
  disabled,
}: JobLinkSelectorProps) {
  const { data: jobs = [] } = useJobs();
  const { data: hint } = useEventJobHint(eventId);

  const currentJob =
    currentJobId != null
      ? (jobs.find((j) => j.id === currentJobId) ?? null)
      : null;

  return (
    <div className="space-y-1.5">
      <Label htmlFor="job-link">Linked job</Label>
      {currentJob ? (
        <div className="flex items-center gap-2">
          <span
            className="flex-1 truncate text-sm"
            data-testid="linked-job-label"
          >
            {currentJob.company} — {currentJob.title}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => onChange(null)}
          >
            Clear
          </Button>
        </div>
      ) : (
        <>
          <select
            id="job-link"
            className="flex h-8 w-full items-center rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm text-foreground outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
            value=""
            onChange={(e) => {
              const v = e.target.value;
              onChange(v ? Number(v) : null);
            }}
            disabled={disabled}
            aria-label="Link to job"
          >
            <option value="">— Not linked —</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.company} — {j.title}
              </option>
            ))}
          </select>
          {hint?.suggested_job_id != null && hint.job != null && (
            <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
              <span>→ Suggested: {hint.job.company}</span>
              <button
                type="button"
                className="text-[var(--accent)] underline"
                disabled={disabled}
                onClick={() => onChange(hint.suggested_job_id)}
              >
                Link
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
