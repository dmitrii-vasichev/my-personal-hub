"use client";

import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { JobDetail } from "@/components/jobs/job-detail";
import { useJob } from "@/hooks/use-jobs";

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = Number(params.id);
  const { data: job, isLoading, error } = useJob(jobId);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-[var(--text-tertiary)]">
        Loading job…
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-[var(--danger)]">Job not found</p>
        <Button variant="ghost" size="sm" onClick={() => router.push("/jobs")}>
          Back to Jobs
        </Button>
      </div>
    );
  }

  return <JobDetail job={job} />;
}
