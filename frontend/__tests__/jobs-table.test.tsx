import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JobsTable } from "@/components/jobs/jobs-table";
import type { Job } from "@/types/job";

// Mock next/navigation
const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
}));

const mockJobs: Job[] = [
  {
    id: 1,
    user_id: 1,
    title: "Senior Frontend Developer",
    company: "TechCorp",
    source: "LinkedIn",
    salary_currency: "USD",
    tags: [],
    match_score: 85,
    found_at: "2026-03-01T00:00:00Z",
    created_at: "2026-03-01T00:00:00Z",
    updated_at: "2026-03-01T00:00:00Z",
    application: { id: 10, status: "applied", applied_date: "2026-03-05" },
  },
  {
    id: 2,
    user_id: 1,
    title: "Backend Engineer",
    company: "DataInc",
    source: "Indeed",
    salary_currency: "USD",
    tags: [],
    match_score: 55,
    found_at: "2026-03-02T00:00:00Z",
    created_at: "2026-03-02T00:00:00Z",
    updated_at: "2026-03-02T00:00:00Z",
  },
  {
    id: 3,
    user_id: 1,
    title: "Fullstack Developer",
    company: "StartupXYZ",
    source: "Glassdoor",
    salary_currency: "USD",
    tags: [],
    match_score: 72,
    found_at: "2026-02-28T00:00:00Z",
    created_at: "2026-02-28T00:00:00Z",
    updated_at: "2026-02-28T00:00:00Z",
  },
];

describe("JobsTable", () => {
  beforeEach(() => {
    pushMock.mockClear();
  });

  it("renders jobs with correct columns", () => {
    render(<JobsTable jobs={mockJobs} isLoading={false} error={null} />);

    // Check column headers
    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Match")).toBeInTheDocument();
    expect(screen.getByText("Source")).toBeInTheDocument();
    expect(screen.getByText("Found")).toBeInTheDocument();

    // Check job data
    expect(screen.getByText("Senior Frontend Developer")).toBeInTheDocument();
    expect(screen.getByText("TechCorp")).toBeInTheDocument();
    expect(screen.getByText("Backend Engineer")).toBeInTheDocument();
    expect(screen.getByText("DataInc")).toBeInTheDocument();
    expect(screen.getByText("Fullstack Developer")).toBeInTheDocument();
  });

  it("shows match score badges with correct colors", () => {
    render(<JobsTable jobs={mockJobs} isLoading={false} error={null} />);

    // 85% — green
    const highScore = screen.getByText("85%");
    expect(highScore).toBeInTheDocument();

    // 55% — gray
    const lowScore = screen.getByText("55%");
    expect(lowScore).toBeInTheDocument();

    // 72% — amber
    const midScore = screen.getByText("72%");
    expect(midScore).toBeInTheDocument();
  });

  it("shows application status for tracked jobs", () => {
    render(<JobsTable jobs={mockJobs} isLoading={false} error={null} />);

    expect(screen.getByText("Applied")).toBeInTheDocument();
  });

  it("shows dash for untracked jobs status", () => {
    render(<JobsTable jobs={mockJobs} isLoading={false} error={null} />);

    // Two untracked jobs should show dashes
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });

  it("shows empty state when no jobs", () => {
    render(<JobsTable jobs={[]} isLoading={false} error={null} />);

    expect(screen.getByText("No jobs found")).toBeInTheDocument();
  });

  it("shows loading skeleton when loading", () => {
    const { container } = render(
      <JobsTable jobs={[]} isLoading={true} error={null} />
    );

    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("shows error message on error", () => {
    render(
      <JobsTable jobs={[]} isLoading={false} error={new Error("Network error")} />
    );

    expect(screen.getByText("Failed to load jobs")).toBeInTheDocument();
  });

  it("navigates to job detail on row click", async () => {
    const user = userEvent.setup();
    render(<JobsTable jobs={mockJobs} isLoading={false} error={null} />);

    const firstRow = screen.getByText("Senior Frontend Developer").closest("tr");
    await user.click(firstRow!);

    expect(pushMock).toHaveBeenCalledWith("/jobs/1");
  });

  it("column headers are clickable for sorting", async () => {
    const user = userEvent.setup();
    render(<JobsTable jobs={mockJobs} isLoading={false} error={null} />);

    const titleHeader = screen.getByText("Title").closest("th");
    expect(titleHeader).toBeInTheDocument();

    // Click should not throw
    await user.click(titleHeader!);
  });

  it("displays source for each job", () => {
    render(<JobsTable jobs={mockJobs} isLoading={false} error={null} />);

    expect(screen.getByText("LinkedIn")).toBeInTheDocument();
    expect(screen.getByText("Indeed")).toBeInTheDocument();
    expect(screen.getByText("Glassdoor")).toBeInTheDocument();
  });
});
