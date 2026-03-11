import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JobDetail } from "@/components/jobs/job-detail";
import type { Job } from "@/types/job";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-jobs", () => ({
  useDeleteJob: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateJob: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useChangeJobStatus: () => ({ mutateAsync: vi.fn() }),
  useStatusHistory: () => ({ data: [] }),
}));

vi.mock("@/components/jobs/job-match-section", () => ({
  JobMatchSection: () => <div data-testid="job-match-section" />,
}));
vi.mock("@/components/jobs/linked-tasks-section", () => ({
  LinkedTasksSection: () => <div data-testid="linked-tasks" />,
}));
vi.mock("@/components/jobs/linked-events-section", () => ({
  LinkedEventsSection: () => <div data-testid="linked-events" />,
}));
vi.mock("@/components/notes/linked-notes-section", () => ({
  LinkedNotesSection: () => <div data-testid="linked-notes" />,
}));
vi.mock("@/hooks/use-note-links", () => ({
  useJobLinkedNotes: () => ({ data: [], isLoading: false }),
  useLinkNoteToJob: () => ({ mutate: vi.fn(), isPending: false }),
  useUnlinkNoteFromJob: () => ({ mutate: vi.fn() }),
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
  tags: [],
  created_at: "2026-03-01T00:00:00Z",
  updated_at: "2026-03-01T00:00:00Z",
};

describe("CollapsibleDescription", () => {
  it("shows description text", () => {
    const job: Job = { ...baseJob, description: "A short description." };
    render(<JobDetail job={job} />);

    expect(screen.getByText("Description")).toBeInTheDocument();
    expect(screen.getByText("A short description.")).toBeInTheDocument();
  });

  it("shows 'Add description' when no description", () => {
    render(<JobDetail job={baseJob} />);

    expect(screen.getByText("Add description…")).toBeInTheDocument();
  });

  it("does not show toggle button for short descriptions", () => {
    const job: Job = { ...baseJob, description: "Short text" };
    render(<JobDetail job={job} />);

    expect(screen.queryByText("Show more")).not.toBeInTheDocument();
    expect(screen.queryByText("Show less")).not.toBeInTheDocument();
  });

  it("shows toggle button and toggles for long descriptions", async () => {
    const longDescription = "Line\n".repeat(50);
    const job: Job = { ...baseJob, description: longDescription };

    // Mock scrollHeight to simulate long content
    const originalScrollHeight = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "scrollHeight"
    );
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
      configurable: true,
      get() {
        if (this.classList?.contains("overflow-hidden")) return 500;
        return originalScrollHeight?.get?.call(this) ?? 0;
      },
    });

    render(<JobDetail job={job} />);

    const showMore = screen.getByText("Show more");
    expect(showMore).toBeInTheDocument();

    await userEvent.click(showMore);
    expect(screen.getByText("Show less")).toBeInTheDocument();

    await userEvent.click(screen.getByText("Show less"));
    expect(screen.getByText("Show more")).toBeInTheDocument();

    // Restore
    if (originalScrollHeight) {
      Object.defineProperty(HTMLElement.prototype, "scrollHeight", originalScrollHeight);
    }
  });
});
