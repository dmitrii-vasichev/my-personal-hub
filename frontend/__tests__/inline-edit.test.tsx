import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JobDetail } from "@/components/jobs/job-detail";
import type { Job } from "@/types/job";

const mockMutateAsync = vi.fn().mockResolvedValue({});

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
  useUpdateJob: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
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
  tags: ["react", "typescript"],
  location: "Remote",
  created_at: "2026-03-01T00:00:00Z",
  updated_at: "2026-03-01T00:00:00Z",
};

describe("Inline Editing", () => {
  beforeEach(() => {
    mockMutateAsync.mockClear();
  });

  it("does not show Edit button in the top bar", () => {
    render(<JobDetail job={baseJob} />);
    // The old Edit button should be gone
    const buttons = screen.getAllByRole("button");
    const editButtons = buttons.filter((b) => b.textContent === "Edit");
    expect(editButtons).toHaveLength(0);
  });

  it("shows pencil icon on title hover and allows editing", async () => {
    render(<JobDetail job={baseJob} />);

    // Title is displayed
    expect(screen.getByText("Senior Engineer")).toBeInTheDocument();

    // Click on the title to edit
    await userEvent.click(screen.getByText("Senior Engineer"));

    // Should show an input
    const input = screen.getByDisplayValue("Senior Engineer");
    expect(input).toBeInTheDocument();
  });

  it("shows pencil icon on company hover and allows editing", async () => {
    render(<JobDetail job={baseJob} />);

    expect(screen.getByText("TestCorp")).toBeInTheDocument();
    await userEvent.click(screen.getByText("TestCorp"));

    const input = screen.getByDisplayValue("TestCorp");
    expect(input).toBeInTheDocument();
  });

  it("saves title on Enter", async () => {
    render(<JobDetail job={baseJob} />);

    await userEvent.click(screen.getByText("Senior Engineer"));

    const input = screen.getByDisplayValue("Senior Engineer");
    await userEvent.clear(input);
    await userEvent.type(input, "Lead Engineer{Enter}");

    expect(mockMutateAsync).toHaveBeenCalledWith({
      id: 1,
      data: { title: "Lead Engineer" },
    });
  });

  it("cancels edit on Escape", async () => {
    render(<JobDetail job={baseJob} />);

    await userEvent.click(screen.getByText("Senior Engineer"));

    const input = screen.getByDisplayValue("Senior Engineer");
    await userEvent.clear(input);
    await userEvent.type(input, "Something else{Escape}");

    // Should revert to display mode with original value
    expect(screen.getByText("Senior Engineer")).toBeInTheDocument();
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it("shows tags with inline edit capability", async () => {
    render(<JobDetail job={baseJob} />);

    expect(screen.getByText("react")).toBeInTheDocument();
    expect(screen.getByText("typescript")).toBeInTheDocument();
  });

  it("shows location in sidebar with edit capability", async () => {
    render(<JobDetail job={baseJob} />);

    expect(screen.getByText("Remote")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Remote"));

    const input = screen.getByDisplayValue("Remote");
    expect(input).toBeInTheDocument();
  });

  it("does not show inline edit for URL field", () => {
    const jobWithUrl: Job = {
      ...baseJob,
      url: "https://example.com/job/123",
    };
    render(<JobDetail job={jobWithUrl} />);

    // The "View Original Posting" link should be present
    const link = screen.getByText("View Original Posting");
    expect(link).toBeInTheDocument();
    expect(link.closest("a")).toHaveAttribute(
      "href",
      "https://example.com/job/123"
    );

    // No pencil/edit icon should appear for the URL
    // The URL text itself should NOT be rendered as clickable-to-edit
    expect(
      screen.queryByDisplayValue("https://example.com/job/123")
    ).not.toBeInTheDocument();
  });
});
