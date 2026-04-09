"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Search, BarChart2, Send, SlidersHorizontal, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { JobSearchInput, JobFilterDropdowns } from "@/components/jobs/job-filters";
import { JobsTable } from "@/components/jobs/jobs-table";
import { JobDialog } from "@/components/jobs/job-dialog";
import { ApplicationKanban } from "@/components/jobs/application-kanban";
import { JobSearch } from "@/components/jobs/job-search";
import { JobAnalytics } from "@/components/jobs/job-analytics";
import { ViewToggle, type JobsViewMode } from "@/components/jobs/view-toggle";
import { BulkImportDialog } from "@/components/jobs/bulk-import-dialog";
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
  const [viewMode, setViewMode] = useState<JobsViewMode>("table");
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

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Jobs</h1>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setBulkImportOpen(true)}
            className="gap-1.5"
          >
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Import from LinkedIn</span>
            <span className="sm:hidden">Import</span>
          </Button>
          <Button
            size="sm"
            onClick={() => { setEditingJob(undefined); setDialogOpen(true); }}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Add Job
          </Button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-[var(--border)]">
        <button
          onClick={() => setActiveTab("jobs")}
          className={`px-3 pb-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === "jobs"
              ? "border-[var(--accent)] text-[var(--text-primary)]"
              : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
        >
          Jobs
          {!isLoading && jobs.length > 0 && (
            <span className="ml-1.5 text-xs text-[var(--text-tertiary)]">({jobs.length})</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("search")}
          className={`flex items-center gap-1.5 px-3 pb-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === "search"
              ? "border-[var(--accent)] text-[var(--text-primary)]"
              : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
        >
          <Search className="h-3.5 w-3.5" />
          Search
        </button>
        <button
          onClick={() => setActiveTab("analytics")}
          className={`flex items-center gap-1.5 px-3 pb-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === "analytics"
              ? "border-[var(--accent)] text-[var(--text-primary)]"
              : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
        >
          <BarChart2 className="h-3.5 w-3.5" />
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
