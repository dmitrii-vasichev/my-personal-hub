import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LinkedTasksSection } from "@/components/jobs/linked-tasks-section";
import { LinkedEventsSection } from "@/components/jobs/linked-events-section";
import type { LinkedTaskBrief } from "@/types/job";

// Mock hooks — use vi.hoisted to avoid TDZ issues with vi.mock hoisting
const { mockLinkedTasks, mockLinkJobToTask, mockUnlinkJobFromTask } = vi.hoisted(() => ({
  mockLinkedTasks: vi.fn(() => ({
    data: [] as LinkedTaskBrief[],
    isLoading: false,
  })),
  mockLinkJobToTask: vi.fn(() => ({
    mutateAsync: vi.fn(),
  })),
  mockUnlinkJobFromTask: vi.fn(() => ({
    mutateAsync: vi.fn(),
  })),
}));

vi.mock("@/hooks/use-job-links", () => ({
  useJobLinkedTasks: mockLinkedTasks,
  useLinkJobToTask: mockLinkJobToTask,
  useUnlinkJobFromTask: mockUnlinkJobFromTask,
  useJobLinkedEvents: vi.fn(() => ({ data: [], isLoading: false })),
  useLinkJobToEvent: vi.fn(() => ({ mutateAsync: vi.fn() })),
  useUnlinkJobFromEvent: vi.fn(() => ({ mutateAsync: vi.fn() })),
}));

vi.mock("@/hooks/use-tasks", () => ({
  useTasks: vi.fn(() => ({ data: [] })),
}));

vi.mock("@/hooks/use-calendar", () => ({
  useCalendarEvents: vi.fn(() => ({ data: [] })),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }
  return Wrapper;
}

describe("LinkedTasksSection", () => {
  it("renders empty state when no tasks linked", () => {
    render(<LinkedTasksSection jobId={1} />, { wrapper: createWrapper() });

    expect(screen.getByText("No tasks linked")).toBeInTheDocument();
    expect(screen.getByText("Link Task")).toBeInTheDocument();
  });

  it("renders linked tasks with status and priority", () => {
    mockLinkedTasks.mockReturnValue({
      data: [
        { id: 1, title: "Write tests", status: "in_progress", priority: "high" },
        { id: 2, title: "Deploy app", status: "todo", priority: "medium" },
      ],
      isLoading: false,
    });

    render(<LinkedTasksSection jobId={1} />, { wrapper: createWrapper() });

    expect(screen.getByText("Write tests")).toBeInTheDocument();
    expect(screen.getByText("Deploy app")).toBeInTheDocument();
    expect(screen.getByText("in progress")).toBeInTheDocument();
    expect(screen.getByText("todo")).toBeInTheDocument();
    expect(screen.getByText("high")).toBeInTheDocument();
    expect(screen.getByText("medium")).toBeInTheDocument();
  });

  it("shows count badge when tasks are linked", () => {
    mockLinkedTasks.mockReturnValue({
      data: [
        { id: 1, title: "Task A", status: "todo", priority: "low" },
      ],
      isLoading: false,
    });

    render(<LinkedTasksSection jobId={1} />, { wrapper: createWrapper() });
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    mockLinkedTasks.mockReturnValue({
      data: [],
      isLoading: true,
    });

    const { container } = render(<LinkedTasksSection jobId={1} />, {
      wrapper: createWrapper(),
    });

    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });
});

describe("LinkedEventsSection", () => {
  it("renders empty state when no events linked", () => {
    render(<LinkedEventsSection jobId={1} />, { wrapper: createWrapper() });

    expect(screen.getByText("No events linked")).toBeInTheDocument();
    expect(screen.getByText("Link Event")).toBeInTheDocument();
  });
});
