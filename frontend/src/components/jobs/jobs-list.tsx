"use client";

import { Briefcase } from "lucide-react";
import { JobCard } from "@/components/jobs/job-card";
import type { Job } from "@/types/job";

function SkeletonCard() {
  return (
    <div className="bg-[#131316] border border-[#232329] rounded-lg p-4 animate-pulse">
      <div className="h-4 bg-[#232329] rounded w-3/4 mb-2" />
      <div className="h-3 bg-[#232329] rounded w-1/2 mb-4" />
      <div className="h-3 bg-[#232329] rounded w-1/3" />
    </div>
  );
}

interface JobsListProps {
  jobs: Job[];
  isLoading: boolean;
  error: Error | null;
  trackingJobId: number | null;
  onEdit: (job: Job) => void;
  onDelete: (job: Job) => void;
  onTrack: (job: Job) => void;
}

export function JobsList({
  jobs,
  isLoading,
  error,
  trackingJobId,
  onEdit,
  onDelete,
  onTrack,
}: JobsListProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center text-[#E5484D]">
        Failed to load jobs
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#131316] border border-[#232329]">
          <Briefcase className="h-5 w-5 text-[#5C5C66]" />
        </div>
        <div>
          <p className="text-sm font-medium text-[#8B8B93]">No jobs found</p>
          <p className="mt-1 text-xs text-[#5C5C66]">
            Add a job to start tracking your applications
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {jobs.map((job) => (
        <JobCard
          key={job.id}
          job={job}
          onEdit={onEdit}
          onDelete={onDelete}
          onTrack={onTrack}
          isTracking={trackingJobId === job.id}
        />
      ))}
    </div>
  );
}
