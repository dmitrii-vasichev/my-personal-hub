"use client";

import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ApplicationDetail } from "@/components/jobs/application-detail";
import { useApplication } from "@/hooks/use-applications";

export default function ApplicationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const applicationId = Number(params.id);
  const { data: application, isLoading, error } = useApplication(applicationId);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-[var(--text-tertiary)]">
        Loading application…
      </div>
    );
  }

  if (error || !application) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-[var(--danger)]">Application not found</p>
        <Button variant="ghost" size="sm" onClick={() => router.push("/jobs?tab=pipeline")}>
          Back to Pipeline
        </Button>
      </div>
    );
  }

  return <ApplicationDetail application={application} />;
}
