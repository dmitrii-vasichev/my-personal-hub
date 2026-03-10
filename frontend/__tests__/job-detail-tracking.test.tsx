import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { JobDetail } from "@/components/jobs/job-detail";
import type { Job } from "@/types/job";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
}));

// Mock hooks
vi.mock("@/hooks/use-jobs", () => ({
  useDeleteJob: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useChangeJobStatus: () => ({ mutateAsync: vi.fn() }),
  useStatusHistory: () => ({ data: [] }),
}));

// Mock child components that fetch data
vi.mock("@/components/jobs/job-match-section", () => ({
  JobMatchSection: () => <div data-testid="job-match-section" />,
}));
vi.mock("@/components/jobs/linked-tasks-section", () => ({
  LinkedTasksSection: () => <div data-testid="linked-tasks" />,
}));
vi.mock("@/components/jobs/linked-events-section", () => ({
  LinkedEventsSection: () => <div data-testid="linked-events" />,
}));
vi.mock("@/components/jobs/resume-section", () => ({
  ResumeSection: () => <div data-testid="resume-section" />,
}));
vi.mock("@/components/jobs/cover-letter-section", () => ({
  CoverLetterSection: () => <div data-testid="cover-letter-section" />,
}));
vi.mock("@/components/jobs/application-timeline", () => ({
  ApplicationTimeline: () => <div data-testid="timeline" />,
}));
vi.mock("@/components/jobs/job-dialog", () => ({
  JobDialog: () => null,
}));
vi.mock("@/components/jobs/status-change-dialog", () => ({
  StatusChangeDialog: () => null,
}));
vi.mock("@/components/jobs/job-tracking-edit-dialog", () => ({
  JobTrackingEditDialog: () => null,
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const baseJob: Job = {
  id: 1,
  user_id: 1,
  title: "Senior Engineer",
  company: "TestCorp",
  source: "LinkedIn",
  salary_currency: "USD",
  tags: ["react", "typescript"],
  created_at: "2026-03-01T00:00:00Z",
  updated_at: "2026-03-01T00:00:00Z",
};

describe("JobDetail — tracking info", () => {
  it("shows Start Tracking button when job has no status", () => {
    render(<JobDetail job={baseJob} />);

    expect(screen.getByText("Start Tracking")).toBeInTheDocument();
    expect(screen.queryByText("Change Status")).not.toBeInTheDocument();
  });

  it("shows status badge and Change Status when job is tracked", () => {
    const trackedJob: Job = { ...baseJob, status: "applied" };
    render(<JobDetail job={trackedJob} />);

    expect(screen.getByText("Applied")).toBeInTheDocument();
    expect(screen.getByText("Change Status")).toBeInTheDocument();
    expect(screen.queryByText("Start Tracking")).not.toBeInTheDocument();
  });

  it("shows notes section when tracked job has notes", () => {
    const job: Job = { ...baseJob, status: "applied", notes: "Great opportunity" };
    render(<JobDetail job={job} />);

    expect(screen.getByText("Notes")).toBeInTheDocument();
    expect(screen.getByText("Great opportunity")).toBeInTheDocument();
  });

  it("shows recruiter info when tracked job has recruiter", () => {
    const job: Job = {
      ...baseJob,
      status: "screening",
      recruiter_name: "Jane Doe",
      recruiter_contact: "jane@corp.com",
    };
    render(<JobDetail job={job} />);

    expect(screen.getByText("Recruiter")).toBeInTheDocument();
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText("jane@corp.com")).toBeInTheDocument();
  });

  it("shows rejection reason for rejected jobs", () => {
    const job: Job = {
      ...baseJob,
      status: "rejected",
      rejection_reason: "Position filled internally",
    };
    render(<JobDetail job={job} />);

    expect(screen.getByText("Rejection Reason")).toBeInTheDocument();
    expect(screen.getByText("Position filled internally")).toBeInTheDocument();
  });

  it("hides tracking sections when job has no status", () => {
    render(<JobDetail job={baseJob} />);

    expect(screen.queryByText("Notes")).not.toBeInTheDocument();
    expect(screen.queryByText("Recruiter")).not.toBeInTheDocument();
    expect(screen.queryByTestId("resume-section")).not.toBeInTheDocument();
    expect(screen.queryByTestId("cover-letter-section")).not.toBeInTheDocument();
  });

  it("shows resume and cover letter sections when tracked", () => {
    const job: Job = { ...baseJob, status: "applied" };
    render(<JobDetail job={job} />);

    expect(screen.getByTestId("resume-section")).toBeInTheDocument();
    expect(screen.getByTestId("cover-letter-section")).toBeInTheDocument();
  });

  it("shows Edit Tracking Info link when tracked", () => {
    const job: Job = { ...baseJob, status: "found" };
    render(<JobDetail job={job} />);

    expect(screen.getByText("Edit Tracking Info")).toBeInTheDocument();
  });
});
