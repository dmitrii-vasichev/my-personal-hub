"use client";

import { useState } from "react";
import {
  Wand2,
  Download,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  Lightbulb,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DemoModeBadge } from "@/components/ui/demo-mode-badge";
import { useAuth } from "@/lib/auth";
import {
  useResumes,
  useGenerateResume,
  useRunAtsAudit,
  useRunGapAnalysis,
} from "@/hooks/use-resumes";
import type { AtsAuditResult, GapAnalysisResult, Resume, ResumeJson } from "@/types/resume";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function AtsScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80 ? "text-[var(--success)] border-[var(--success)]" :
    score >= 60 ? "text-[var(--warning)] border-[var(--warning)]" :
    "text-[var(--danger)] border-[var(--danger)]";
  return (
    <span className={`rounded border px-2 py-0.5 text-xs font-semibold ${color}`}>
      ATS {score}
    </span>
  );
}

function ResumePreview({ json }: { json: ResumeJson }) {
  const contact = json.contact ?? {};
  return (
    <div className="space-y-3 text-sm">
      {contact.name && (
        <div>
          <p className="font-semibold text-base">{contact.name}</p>
          <p className="text-xs text-muted-foreground">
            {[contact.email, contact.phone, contact.location].filter(Boolean).join(" · ")}
          </p>
        </div>
      )}
      {json.summary && <p className="text-xs text-muted-foreground">{json.summary}</p>}
      {(json.experience ?? []).length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Experience</p>
          {json.experience!.map((exp, i) => (
            <div key={i} className="mb-2">
              <p className="text-xs font-medium">{exp.title} — {exp.company}</p>
              <p className="text-[11px] text-muted-foreground">{exp.start} – {exp.end ?? "Present"}</p>
              {exp.bullets.slice(0, 2).map((b, j) => (
                <p key={j} className="text-[11px] text-muted-foreground pl-3">• {b}</p>
              ))}
            </div>
          ))}
        </div>
      )}
      {(json.skills ?? []).length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Skills</p>
          <div className="flex flex-wrap gap-1">
            {json.skills!.map((s) => (
              <span key={s} className="rounded bg-surface-hover border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AuditPanel({ audit }: { audit: AtsAuditResult }) {
  return (
    <div className="space-y-3 rounded-lg border border-border p-4 text-xs">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="font-medium text-[var(--success)] mb-1 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Matched Keywords
          </p>
          <div className="flex flex-wrap gap-1">
            {audit.matched_keywords.map((k) => (
              <span key={k} className="rounded bg-[var(--success)]/10 text-[var(--success)] px-1.5 py-0.5">{k}</span>
            ))}
          </div>
        </div>
        <div>
          <p className="font-medium text-[var(--danger)] mb-1 flex items-center gap-1">
            <XCircle className="h-3 w-3" /> Missing Keywords
          </p>
          <div className="flex flex-wrap gap-1">
            {audit.missing_keywords.map((k) => (
              <span key={k} className="rounded bg-[var(--danger)]/10 text-[var(--danger)] px-1.5 py-0.5">{k}</span>
            ))}
          </div>
        </div>
      </div>
      {audit.suggestions.length > 0 && (
        <div>
          <p className="font-medium text-muted-foreground mb-1 flex items-center gap-1">
            <Lightbulb className="h-3 w-3" /> Suggestions
          </p>
          <ul className="space-y-1">
            {audit.suggestions.map((s, i) => (
              <li key={i} className="text-muted-foreground">• {s}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function GapPanel({ gap }: { gap: GapAnalysisResult }) {
  return (
    <div className="space-y-3 rounded-lg border border-border p-4 text-xs">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="font-medium text-[var(--success)] mb-1">Matching Skills</p>
          <ul className="space-y-0.5 text-muted-foreground">
            {gap.matching_skills.map((s, i) => <li key={i}>✓ {s}</li>)}
          </ul>
        </div>
        <div>
          <p className="font-medium text-[var(--warning)] mb-1">Missing Skills</p>
          <ul className="space-y-0.5 text-muted-foreground">
            {gap.missing_skills.map((s, i) => <li key={i}>✗ {s}</li>)}
          </ul>
        </div>
      </div>
      {gap.recommendations.length > 0 && (
        <div>
          <p className="font-medium text-muted-foreground mb-1">Recommendations</p>
          <ul className="space-y-1 text-muted-foreground">
            {gap.recommendations.map((r, i) => <li key={i}>• {r}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function ResumeCard({
  resume,
}: {
  resume: Resume;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [showGap, setShowGap] = useState(false);
  const runAts = useRunAtsAudit();
  const runGap = useRunGapAnalysis();

  const handleAts = async () => {
    try {
      await runAts.mutateAsync(resume.id);
      setShowAudit(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ATS audit failed");
    }
  };

  const handleGap = async () => {
    try {
      await runGap.mutateAsync(resume.id);
      setShowGap(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gap analysis failed");
    }
  };

  return (
    <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">v{resume.version}</span>
          {resume.ats_score !== null && <AtsScoreBadge score={resume.ats_score} />}
          <span className="text-xs text-muted-foreground">
            {new Date(resume.created_at).toLocaleDateString()}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs gap-1"
            onClick={() => setExpanded((e) => !e)}
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? "Collapse" : "Preview"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs gap-1"
            onClick={handleAts}
            disabled={runAts.isPending}
          >
            {runAts.isPending ? "Running…" : resume.ats_audit_result ? "Re-audit" : "ATS Audit"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs gap-1"
            onClick={handleGap}
            disabled={runGap.isPending}
          >
            {runGap.isPending ? "Running…" : resume.gap_analysis ? "Re-analyze" : "Gap Analysis"}
          </Button>
          <a
            href={`${API_BASE}/api/resumes/${resume.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button size="sm" variant="secondary" className="h-7 text-xs gap-1">
              <Download className="h-3 w-3" />
              PDF
            </Button>
          </a>
        </div>
      </div>

      {expanded && <ResumePreview json={resume.resume_json} />}
      {showAudit && resume.ats_audit_result && <AuditPanel audit={resume.ats_audit_result as AtsAuditResult} />}
      {showGap && resume.gap_analysis && <GapPanel gap={resume.gap_analysis as GapAnalysisResult} />}
    </div>
  );
}

export function ResumeSection({ jobId }: { jobId: number }) {
  const { data: resumes = [], isLoading } = useResumes(jobId);
  const generate = useGenerateResume();
  const { isDemo } = useAuth();

  const handleGenerate = async () => {
    try {
      await generate.mutateAsync(jobId);
      toast.success("Resume generated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed");
    }
  };

  if (isDemo) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-medium">AI Resume</h3>
        <DemoModeBadge feature="AI Resume Generation" description="Generate tailored resumes, run ATS audits, and gap analysis" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">AI Resume</h3>
        <Button size="sm" variant="secondary" onClick={handleGenerate} disabled={generate.isPending} className="gap-1.5 h-7 text-xs">
          <Wand2 className="h-3 w-3" />
          {generate.isPending ? "Generating…" : "Generate Resume"}
        </Button>
      </div>

      {isLoading && <p className="text-xs text-muted-foreground">Loading…</p>}

      {!isLoading && resumes.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No resumes yet. Generate one to get started.
        </p>
      )}

      <div className="space-y-2">
        {resumes.map((r) => (
          <ResumeCard key={r.id} resume={r} />
        ))}
      </div>
    </div>
  );
}
