"use client";

import { useState } from "react";
import { Plus, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { JobFiltersBar } from "@/components/jobs/job-filters";
import { JobsList } from "@/components/jobs/jobs-list";
import { useJobs, useDeleteJob } from "@/hooks/use-jobs";
import { useCreateApplication } from "@/hooks/use-applications";
import type { Job, JobFilters } from "@/types/job";

type Tab = "jobs" | "pipeline";

export default function JobsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("jobs");
  const [filters, setFilters] = useState<JobFilters>({});
  const [trackingJobId, setTrackingJobId] = useState<number | null>(null);

  const { data: jobs = [], isLoading, error } = useJobs(filters);
  const createApplication = useCreateApplication();
  const deleteJob = useDeleteJob();

  const handleTrack = async (job: Job) => {
    setTrackingJobId(job.id);
    try {
      await createApplication.mutateAsync({ job_id: job.id });
      setActiveTab("pipeline");
    } catch {
      // Mutation failure — stay on current tab, error shown inline if needed
    } finally {
      setTrackingJobId(null);
    }
  };

  const handleEdit = (job: Job) => {
    // Edit dialog — placeholder until Task 7 (job form dialog)
    console.log("Edit job", job.id);
  };

  const handleDelete = async (job: Job) => {
    if (!confirm(`Delete "${job.title}" at ${job.company}?`)) return;
    await deleteJob.mutateAsync(job.id);
  };

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[#EDEDEF]">Jobs</h1>
        <Button
          size="sm"
          className="gap-1.5 bg-[#5B6AD0] hover:bg-[#6E7CE0] text-white border-0"
          onClick={() => console.log("Open add-job dialog")}
        >
          <Plus className="h-4 w-4" />
          Add Job
        </Button>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-[#232329]">
        <button
          onClick={() => setActiveTab("jobs")}
          className={`px-3 pb-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === "jobs"
              ? "border-[#5B6AD0] text-[#EDEDEF]"
              : "border-transparent text-[#8B8B93] hover:text-[#EDEDEF]"
          }`}
        >
          Jobs
          {!isLoading && jobs.length > 0 && (
            <span className="ml-1.5 text-xs text-[#5C5C66]">({jobs.length})</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("pipeline")}
          className={`flex items-center gap-1.5 px-3 pb-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === "pipeline"
              ? "border-[#5B6AD0] text-[#EDEDEF]"
              : "border-transparent text-[#8B8B93] hover:text-[#EDEDEF]"
          }`}
        >
          <GitBranch className="h-3.5 w-3.5" />
          Pipeline
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
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#131316] border border-[#232329]">
            <GitBranch className="h-5 w-5 text-[#5C5C66]" />
          </div>
          <div>
            <p className="text-sm font-medium text-[#8B8B93]">Pipeline view coming in Task 8</p>
            <p className="mt-1 text-xs text-[#5C5C66]">
              Kanban board for tracking application stages
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
