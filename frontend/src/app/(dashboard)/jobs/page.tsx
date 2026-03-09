"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, GitBranch, Search, BarChart2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { JobFiltersBar } from "@/components/jobs/job-filters";
import { JobsList } from "@/components/jobs/jobs-list";
import { JobDialog } from "@/components/jobs/job-dialog";
import { ApplicationKanban } from "@/components/jobs/application-kanban";
import { JobSearch } from "@/components/jobs/job-search";
import { JobAnalytics } from "@/components/jobs/job-analytics";
import { useJobs, useDeleteJob } from "@/hooks/use-jobs";
import { useCreateApplication } from "@/hooks/use-applications";
import type { Job, JobFilters } from "@/types/job";

type Tab = "jobs" | "pipeline" | "search" | "analytics";

function JobsPageInner() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const tab = searchParams.get("tab");
    if (tab === "pipeline") return "pipeline";
    if (tab === "search") return "search";
    if (tab === "analytics") return "analytics";
    return "jobs";
  });
  const [filters, setFilters] = useState<JobFilters>({});
  const [trackingJobId, setTrackingJobId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | undefined>();

  const { data: jobs = [], isLoading, error } = useJobs(filters);
  const createApplication = useCreateApplication();
  const deleteJob = useDeleteJob();

  const handleTrack = async (job: Job) => {
    setTrackingJobId(job.id);
    try {
      await createApplication.mutateAsync({ job_id: job.id });
      setActiveTab("pipeline");
    } catch {
      toast.error("Failed to start tracking");
    } finally {
      setTrackingJobId(null);
    }
  };

  const handleEdit = (job: Job) => {
    setEditingJob(job);
    setDialogOpen(true);
  };

  const handleDelete = async (job: Job) => {
    if (!confirm(`Delete "${job.title}" at ${job.company}?`)) return;
    await deleteJob.mutateAsync(job.id);
  };

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[#e8eaf0]">Jobs</h1>
        <Button
          size="sm"
          className="gap-1.5 bg-[#4f8ef7] hover:bg-[#6ba3ff] text-white border-0"
          onClick={() => { setEditingJob(undefined); setDialogOpen(true); }}
        >
          <Plus className="h-4 w-4" />
          Add Job
        </Button>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-[#252a3a]">
        <button
          onClick={() => setActiveTab("jobs")}
          className={`px-3 pb-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === "jobs"
              ? "border-[#4f8ef7] text-[#e8eaf0]"
              : "border-transparent text-[#6b7280] hover:text-[#e8eaf0]"
          }`}
        >
          Jobs
          {!isLoading && jobs.length > 0 && (
            <span className="ml-1.5 text-xs text-[#4b5563]">({jobs.length})</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("pipeline")}
          className={`flex items-center gap-1.5 px-3 pb-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === "pipeline"
              ? "border-[#4f8ef7] text-[#e8eaf0]"
              : "border-transparent text-[#6b7280] hover:text-[#e8eaf0]"
          }`}
        >
          <GitBranch className="h-3.5 w-3.5" />
          Pipeline
        </button>
        <button
          onClick={() => setActiveTab("search")}
          className={`flex items-center gap-1.5 px-3 pb-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === "search"
              ? "border-[#4f8ef7] text-[#e8eaf0]"
              : "border-transparent text-[#6b7280] hover:text-[#e8eaf0]"
          }`}
        >
          <Search className="h-3.5 w-3.5" />
          Search
        </button>
        <button
          onClick={() => setActiveTab("analytics")}
          className={`flex items-center gap-1.5 px-3 pb-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === "analytics"
              ? "border-[#4f8ef7] text-[#e8eaf0]"
              : "border-transparent text-[#6b7280] hover:text-[#e8eaf0]"
          }`}
        >
          <BarChart2 className="h-3.5 w-3.5" />
          Analytics
        </button>
      </div>

      {/* Tab content */}
      {activeTab === "jobs" ? (
        <>
          {/* Filter bar */}
          <JobFiltersBar filters={filters} onFiltersChange={setFilters} />

          {/* Jobs list */}
          <div className="flex-1 overflow-auto">
            <JobsList
              jobs={jobs}
              isLoading={isLoading}
              error={error as Error | null}
              trackingJobId={trackingJobId}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onTrack={handleTrack}
            />
          </div>
        </>
      ) : activeTab === "pipeline" ? (
        <div className="flex-1 overflow-auto">
          <ApplicationKanban />
        </div>
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
