import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DigestItemCard } from "@/components/pulse/digest-item-card";
import { JobDigestItemCard } from "@/components/pulse/job-digest-item-card";
import type { DigestItem } from "@/types/pulse-digest";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockLearningItem: DigestItem = {
  id: 1,
  digest_id: 10,
  title: "How to Build Better APIs",
  summary: "A comprehensive guide to REST API design with practical examples and best practices.",
  classification: "article",
  metadata: null,
  source_names: ["Tech Channel", "Dev News"],
  status: "new",
  action_type: null,
  action_result_id: null,
  created_at: "2026-03-19T12:00:00Z",
};

const mockActionedItem: DigestItem = {
  ...mockLearningItem,
  id: 2,
  status: "actioned",
  action_type: "to_task",
  action_result_id: 42,
};

const mockSkippedItem: DigestItem = {
  ...mockLearningItem,
  id: 3,
  status: "skipped",
  action_type: "skip",
};

const mockJobItem: DigestItem = {
  id: 4,
  digest_id: 11,
  title: "Senior Backend Engineer",
  summary: "Building scalable microservices with Go and Kubernetes.",
  classification: "vacancy",
  metadata: {
    company: "Acme Corp",
    salary_range: "$150k-$200k",
    location: "Remote",
    url: "https://example.com/job/123",
  },
  source_names: ["Job Board"],
  status: "new",
  action_type: null,
  action_result_id: null,
  created_at: "2026-03-19T12:00:00Z",
};

const mockJobActionedItem: DigestItem = {
  ...mockJobItem,
  id: 5,
  status: "actioned",
  action_type: "to_job",
};

describe("DigestItemCard", () => {
  it("renders title, summary, classification badge, and source names", () => {
    render(
      <DigestItemCard
        item={mockLearningItem}
        selected={false}
        onToggle={vi.fn()}
        onAction={vi.fn()}
        isPending={false}
      />
    );

    expect(screen.getByTestId("digest-item-card")).toBeInTheDocument();
    expect(screen.getByText("How to Build Better APIs")).toBeInTheDocument();
    expect(screen.getByText(/comprehensive guide/)).toBeInTheDocument();
    expect(screen.getByText("Article")).toBeInTheDocument();
    expect(screen.getByText("Tech Channel")).toBeInTheDocument();
    expect(screen.getByText("Dev News")).toBeInTheDocument();
  });

  it("calls onAction with correct action type", () => {
    const onAction = vi.fn();
    render(
      <DigestItemCard
        item={mockLearningItem}
        selected={false}
        onToggle={vi.fn()}
        onAction={onAction}
        isPending={false}
      />
    );

    fireEvent.click(screen.getByTitle("Save as Task"));
    expect(onAction).toHaveBeenCalledWith("to_task");

    fireEvent.click(screen.getByTitle("Save as Note"));
    expect(onAction).toHaveBeenCalledWith("to_note");

    fireEvent.click(screen.getByTitle("Skip"));
    expect(onAction).toHaveBeenCalledWith("skip");
  });

  it("calls onToggle when checkbox clicked", () => {
    const onToggle = vi.fn();
    render(
      <DigestItemCard
        item={mockLearningItem}
        selected={false}
        onToggle={onToggle}
        onAction={vi.fn()}
        isPending={false}
      />
    );

    // Find the checkbox button (first button in the component)
    const buttons = screen.getByTestId("digest-item-card").querySelectorAll("button");
    fireEvent.click(buttons[0]);
    expect(onToggle).toHaveBeenCalled();
  });

  it("shows actioned items as dimmed with action label", () => {
    render(
      <DigestItemCard
        item={mockActionedItem}
        selected={false}
        onToggle={vi.fn()}
        onAction={vi.fn()}
        isPending={false}
      />
    );

    const card = screen.getByTestId("digest-item-card");
    expect(card.className).toContain("opacity-50");
    expect(screen.getByText("Saved as task")).toBeInTheDocument();
    // No action buttons for actioned items
    expect(screen.queryByTitle("Save as Task")).not.toBeInTheDocument();
  });

  it("shows skipped items as dimmed", () => {
    render(
      <DigestItemCard
        item={mockSkippedItem}
        selected={false}
        onToggle={vi.fn()}
        onAction={vi.fn()}
        isPending={false}
      />
    );

    const card = screen.getByTestId("digest-item-card");
    expect(card.className).toContain("opacity-50");
    expect(screen.getByText("Skipped")).toBeInTheDocument();
  });
});

describe("JobDigestItemCard", () => {
  it("renders vacancy metadata (company, salary, location, url)", () => {
    render(
      <JobDigestItemCard
        item={mockJobItem}
        selected={false}
        onToggle={vi.fn()}
        onAction={vi.fn()}
        isPending={false}
      />
    );

    expect(screen.getByTestId("job-digest-item-card")).toBeInTheDocument();
    expect(screen.getByText("Senior Backend Engineer")).toBeInTheDocument();
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText("$150k-$200k")).toBeInTheDocument();
    expect(screen.getByText("Remote")).toBeInTheDocument();
    expect(screen.getByText("Link")).toBeInTheDocument();
    expect(screen.getByText("Job Board")).toBeInTheDocument();
  });

  it("→ Job Hunt button calls onAction with to_job", () => {
    const onAction = vi.fn();
    render(
      <JobDigestItemCard
        item={mockJobItem}
        selected={false}
        onToggle={vi.fn()}
        onAction={onAction}
        isPending={false}
      />
    );

    fireEvent.click(screen.getByTitle("Add to Job Hunt"));
    expect(onAction).toHaveBeenCalledWith("to_job");
  });

  it("shows actioned item with label and no action buttons", () => {
    render(
      <JobDigestItemCard
        item={mockJobActionedItem}
        selected={false}
        onToggle={vi.fn()}
        onAction={vi.fn()}
        isPending={false}
      />
    );

    expect(screen.getByText("Added to Job Hunt")).toBeInTheDocument();
    expect(screen.queryByTitle("Add to Job Hunt")).not.toBeInTheDocument();
  });

  it("hides missing optional fields gracefully", () => {
    const itemNoMeta: DigestItem = {
      ...mockJobItem,
      id: 6,
      metadata: { company: null, salary_range: null, location: null, url: null },
    };

    render(
      <JobDigestItemCard
        item={itemNoMeta}
        selected={false}
        onToggle={vi.fn()}
        onAction={vi.fn()}
        isPending={false}
      />
    );

    expect(screen.getByText("Senior Backend Engineer")).toBeInTheDocument();
    expect(screen.queryByText("Acme Corp")).not.toBeInTheDocument();
    expect(screen.queryByText("Link")).not.toBeInTheDocument();
  });
});

describe("PulseDigestsPage", () => {
  it("does not have an Inbox tab", async () => {
    // Mocking is already set up in pulse-digests.test.tsx;
    // here we just verify through the page import
    const { default: PulseDigestsPage } = await import(
      "@/app/(dashboard)/pulse/page"
    );
    const { QueryClient, QueryClientProvider } = await import(
      "@tanstack/react-query"
    );

    vi.mock("@/hooks/use-pulse-digests", () => ({
      useLatestDigest: () => ({ data: null, isLoading: false }),
      useGenerateDigest: () => ({ mutate: vi.fn(), isPending: false }),
    }));

    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={qc}>
        <PulseDigestsPage />
      </QueryClientProvider>
    );

    expect(screen.queryByText("Inbox")).not.toBeInTheDocument();
    expect(screen.getByText("Latest")).toBeInTheDocument();
    expect(screen.getByText("History")).toBeInTheDocument();
  });
});
