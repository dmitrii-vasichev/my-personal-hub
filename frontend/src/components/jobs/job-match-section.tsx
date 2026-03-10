"use client";

import { Loader2, Sparkles, RefreshCw, CheckCircle2, XCircle, Lightbulb, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRunJobMatch } from "@/hooks/use-job-match";
import type { Job } from "@/types/job";

interface JobMatchSectionProps {
  job: Job;
}

function getScoreColor(score: number) {
  if (score >= 80) return { text: "text-[#34d399]", bg: "bg-[#0f2d22]" };
  if (score >= 60) return { text: "text-[#fbbf24]", bg: "bg-[#2a2510]" };
  if (score >= 40) return { text: "text-[var(--accent)]", bg: "bg-[var(--accent-muted)]" };
  return { text: "text-[var(--text-tertiary)]", bg: "bg-[var(--surface-hover)]" };
}

export function JobMatchSection({ job }: JobMatchSectionProps) {
  const runMatch = useRunJobMatch(job.id);
  const result = job.match_result;

  const handleMatch = () => {
    runMatch.mutate(undefined, {
      onError: (error: Error) => {
        // Error is handled by displaying inline
      },
    });
  };

  // No result yet — show "Run Match" button
  if (!result && !runMatch.isPending && !runMatch.isError) {
    return (
      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
          AI Match Analysis
        </h3>
        <div className="rounded-lg border border-dashed border-[var(--border)] p-6 text-center">
          <Sparkles className="mx-auto mb-2 h-6 w-6 text-[var(--text-tertiary)]" />
          <p className="mb-3 text-sm text-[var(--text-secondary)]">
            Compare this job against your profile
          </p>
          <Button
            size="sm"
            onClick={handleMatch}
            className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white border-0"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Run Match
          </Button>
        </div>
      </div>
    );
  }

  // Loading state
  if (runMatch.isPending) {
    return (
      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
          AI Match Analysis
        </h3>
        <div className="rounded-lg border border-[var(--border)] p-6 text-center">
          <Loader2 className="mx-auto mb-2 h-6 w-6 text-[var(--accent)] animate-spin" />
          <p className="text-sm text-[var(--text-secondary)]">Analyzing match...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (runMatch.isError && !result) {
    const errorMsg = runMatch.error?.message || "Match failed";
    return (
      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
          AI Match Analysis
        </h3>
        <div className="rounded-lg border border-[var(--destructive)] bg-[var(--destructive-muted)] p-4">
          <p className="mb-2 text-sm text-[var(--destructive)]">{errorMsg}</p>
          <Button variant="outline" size="sm" onClick={handleMatch}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  // Result display
  if (!result) return null;

  const scoreColor = getScoreColor(result.score);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
          AI Match Analysis
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleMatch}
          disabled={runMatch.isPending}
          className="h-7 px-2 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
        >
          {runMatch.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          Re-run
        </Button>
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-4">
        {/* Score badge */}
        <div className="flex items-center gap-3">
          <div className={`flex items-center justify-center w-14 h-14 rounded-lg ${scoreColor.bg}`}>
            <span className={`text-2xl font-bold font-mono ${scoreColor.text}`}>
              {result.score}
            </span>
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--text-primary)]">Match Score</p>
            <p className="text-xs text-[var(--text-tertiary)]">
              {result.score >= 80
                ? "Strong match"
                : result.score >= 60
                ? "Good match"
                : result.score >= 40
                ? "Moderate match"
                : "Low match"}
            </p>
          </div>
        </div>

        {/* Matched skills */}
        {result.matched_skills.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-[#34d399]" />
              <span className="text-xs font-medium text-[var(--text-secondary)]">
                Matched Skills
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {result.matched_skills.map((skill) => (
                <span
                  key={skill}
                  className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#0f2d22] text-[#34d399] border border-[rgba(52,211,153,0.2)]"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Missing skills */}
        {result.missing_skills.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <XCircle className="h-3.5 w-3.5 text-[#fbbf24]" />
              <span className="text-xs font-medium text-[var(--text-secondary)]">
                Missing Skills
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {result.missing_skills.map((skill) => (
                <span
                  key={skill}
                  className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#2a2510] text-[#fbbf24] border border-[rgba(251,191,36,0.2)]"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Strengths */}
        {result.strengths.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Trophy className="h-3.5 w-3.5 text-[var(--accent)]" />
              <span className="text-xs font-medium text-[var(--text-secondary)]">
                Strengths
              </span>
            </div>
            <ul className="space-y-1">
              {result.strengths.map((s, i) => (
                <li
                  key={i}
                  className="text-xs text-[var(--text-primary)] pl-4 relative before:content-['•'] before:absolute before:left-0 before:text-[var(--text-tertiary)]"
                >
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recommendations */}
        {result.recommendations.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Lightbulb className="h-3.5 w-3.5 text-[var(--accent-amber)]" />
              <span className="text-xs font-medium text-[var(--text-secondary)]">
                Recommendations
              </span>
            </div>
            <ul className="space-y-1">
              {result.recommendations.map((r, i) => (
                <li
                  key={i}
                  className="text-xs text-[var(--text-primary)] pl-4 relative before:content-['•'] before:absolute before:left-0 before:text-[var(--text-tertiary)]"
                >
                  {r}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
