"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Send, SlidersHorizontal } from "lucide-react";
import { JobSearchInput, JobFilterDropdowns } from "@/components/jobs/job-filters";
import { JobsTable } from "@/components/jobs/jobs-table";
import { JobDialog } from "@/components/jobs/job-dialog";
import { ApplicationKanban } from "@/components/jobs/application-kanban";
import { JobSearch } from "@/components/jobs/job-search";
import { JobAnalytics } from "@/components/jobs/job-analytics";
import { ViewToggle, type JobsViewMode } from "@/components/jobs/view-toggle";
import { BulkImportDialog } from "@/components/jobs/bulk-import-dialog";
import { JobsHero } from "@/components/jobs/jobs-hero";
import { useJobs } from "@/hooks/use-jobs";
import type { Job, JobFilters } from "@/types/job";

type Tab = "jobs" | "search" | "analytics";

function JobsPageInner() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const tab = searchParams.get("tab");
    if (tab === "search") return "search";
    if (tab === "analytics") return "analytics";
    return "jobs";
  });
  const [viewMode, setViewMode] = useState<JobsViewMode>("kanban");
  const [filters, setFilters] = useState<JobFilters>({});
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | undefined>();

  const { data: jobs = [], isLoading, error } = useJobs(filters);

  const appliedTodayCount = useMemo(() => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const notAppliedStatuses = new Set(["found", "saved", "resume_generated"]);
    return jobs.filter((j) => {
      if (!j.status || notAppliedStatuses.has(j.status)) return false;
      const created = new Date(j.created_at);
      const createdStr = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, "0")}-${String(created.getDate()).padStart(2, "0")}`;
      return createdStr === todayStr;
    }).length;
  }, [jobs]);

  // Subline counts — derived from hook data.
  const { liveCount, interviewCount, offerCount } = useMemo(() => {
    const liveSet = new Set<string>([
      "applied",
      "screening",
      "technical_interview",
      "final_interview",
    ]);
    const interviewSet = new Set<string>([
      "technical_interview",
      "final_interview",
    ]);
    let live = 0;
    let interview = 0;
    let offer = 0;
    for (const j of jobs) {
      if (!j.status) continue;
      if (liveSet.has(j.status)) live += 1;
      if (interviewSet.has(j.status)) interview += 1;
      if (j.status === "offer") offer += 1;
    }
    return { liveCount: live, interviewCount: interview, offerCount: offer };
  }, [jobs]);

  const sublineEmpty =
    liveCount === 0 && interviewCount === 0 && offerCount === 0;

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Page header · brutalist .ph */}
      <header className="border-b-[1.5px] border-[color:var(--line)] pb-[14px]">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[1.5px] text-[color:var(--ink-3)] font-mono">
              Module · Job Hunt
            </div>
            <h1 className="mt-1 font-bold text-[28px] leading-[1.1] tracking-[-0.4px] text-[color:var(--ink)]">
              JOB_HUNT_
            </h1>
            <p className="mt-1 text-[12px] text-[color:var(--ink-3)] font-mono">
              {sublineEmpty
                ? "No active applications — start tracking one."
                : `${liveCount} live · ${interviewCount} in interview · ${offerCount} offer`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("search")}
              className="border-[1.5px] border-[color:var(--line)] px-3 py-1.5 text-[11px] uppercase tracking-[1.5px] font-mono text-[color:var(--ink-3)] hover:text-[color:var(--ink)] hover:border-[color:var(--line-2)] transition-colors"
            >
              Search
            </button>
            <button
              type="button"
              onClick={() => setBulkImportOpen(true)}
              className="border-[1.5px] border-[color:var(--line)] px-3 py-1.5 text-[11px] uppercase tracking-[1.5px] font-mono text-[color:var(--ink-3)] hover:text-[color:var(--ink)] hover:border-[color:var(--line-2)] transition-colors"
            >
              Import
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingJob(undefined);
                setDialogOpen(true);
              }}
              className="border-[1.5px] border-[color:var(--accent)] bg-[color:var(--accent)] px-3 py-1.5 text-[11px] uppercase tracking-[1.5px] text-[color:var(--bg)] font-mono font-bold"
            >
              + New App
            </button>
          </div>
        </div>
      </header>

      {/* Stat-cells hero */}
      <JobsHero jobs={jobs} />

      {/* Tab bar · brutalist */}
      <div className="flex items-center gap-0 border-b-[1.5px] border-[color:var(--line)]">
        <button
          type="button"
          onClick={() => setActiveTab("jobs")}
          className={`px-4 py-2 text-[11px] uppercase tracking-[1.5px] font-mono transition-colors border-b-[3px] -mb-[1.5px] ${
            activeTab === "jobs"
              ? "border-[color:var(--accent)] text-[color:var(--ink)]"
              : "border-transparent text-[color:var(--ink-3)] hover:text-[color:var(--ink)]"
          }`}
        >
          Jobs
          {!isLoading && jobs.length > 0 && (
            <span className="ml-1.5 text-[10px] text-[color:var(--ink-3)]">
              ({jobs.length})
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("search")}
          className={`px-4 py-2 text-[11px] uppercase tracking-[1.5px] font-mono transition-colors border-b-[3px] -mb-[1.5px] ${
            activeTab === "search"
              ? "border-[color:var(--accent)] text-[color:var(--ink)]"
              : "border-transparent text-[color:var(--ink-3)] hover:text-[color:var(--ink)]"
          }`}
        >
          Search
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("analytics")}
          className={`px-4 py-2 text-[11px] uppercase tracking-[1.5px] font-mono transition-colors border-b-[3px] -mb-[1.5px] ${
            activeTab === "analytics"
              ? "border-[color:var(--accent)] text-[color:var(--ink)]"
              : "border-transparent text-[color:var(--ink-3)] hover:text-[color:var(--ink)]"
          }`}
        >
          Analytics
        </button>
      </div>

      {/* Tab content */}
      {activeTab === "jobs" ? (
        <>
          {/* Toolbar */}
          <div className="flex flex-col gap-2">
            {/* Main row */}
            <div className="flex items-center gap-2 md:gap-4">
              <div className="flex flex-1 items-center gap-2">
                <JobSearchInput
                  value={filters.search}
                  onChange={(search) => setFilters((f) => ({ ...f, search }))}
                />
                <div className="hidden md:flex items-center gap-2">
                  <JobFilterDropdowns filters={filters} onFiltersChange={setFilters} />
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {appliedTodayCount > 0 && (
                  <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--accent-teal)]">
                    <Send className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Applied today:</span> {appliedTodayCount}
                  </div>
                )}
                <div className="hidden md:block">
                  <ViewToggle value={viewMode} onChange={setViewMode} />
                </div>
                <button
                  onClick={() => setShowMobileFilters((v) => !v)}
                  className={`md:hidden shrink-0 p-1.5 rounded-md border transition-colors ${
                    showMobileFilters
                      ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10"
                      : "border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
                  }`}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Mobile filter panel */}
            {showMobileFilters && (
              <div className="flex md:hidden items-center gap-2 flex-wrap">
                <JobFilterDropdowns filters={filters} onFiltersChange={setFilters} />
                <ViewToggle value={viewMode} onChange={setViewMode} />
              </div>
            )}
          </div>

          {/* Jobs content — table or kanban */}
          <div className="flex-1 overflow-auto">
            {viewMode === "table" ? (
              <JobsTable
                jobs={jobs}
                isLoading={isLoading}
                error={error as Error | null}
              />
            ) : (
              <ApplicationKanban />
            )}
          </div>
        </>
      ) : activeTab === "search" ? (
        <div className="flex-1 overflow-auto">
          <JobSearch />
        </div>
      ) : (
        <div className="flex-1 overflow-auto pb-4">
          <JobAnalytics />
        </div>
      )}

      <JobDialog
        key={editingJob?.id ?? "create"}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={editingJob ? "edit" : "create"}
        job={editingJob}
        onSuccess={() => {
          setDialogOpen(false);
          setEditingJob(undefined);
        }}
      />

      <BulkImportDialog
        open={bulkImportOpen}
        onOpenChange={setBulkImportOpen}
      />
    </div>
  );
}

export default function JobsPage() {
  return (
    <Suspense fallback={null}>
      <JobsPageInner />
    </Suspense>
  );
}
