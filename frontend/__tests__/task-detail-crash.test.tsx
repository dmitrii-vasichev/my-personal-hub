import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "1" }),
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
  }),
}));

// Mock auth
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    user: { id: 1, role: "admin", display_name: "Test User", email: "test@test.com" },
    isLoading: false,
  }),
}));

// Mock task hooks
const mockTask = {
  id: 1,
  user_id: 1,
  created_by_id: 1,
  assignee_id: null,
  title: "Test Task",
  description: "A test description",
  status: "new" as const,
  priority: "medium" as const,
  checklist: [
    { id: "1", text: "Step 1", completed: false },
    { id: "2", text: "Step 2", completed: true },
  ],
  source: "manual",
  visibility: "family" as const,
  deadline: "2026-04-01",
  reminder_at: null,
  completed_at: null,
  created_at: "2026-03-10T12:00:00Z",
  updated_at: "2026-03-10T12:00:00Z",
  owner_name: "Test User",
  assignee: null,
};

vi.mock("@/hooks/use-tasks", () => ({
  useTask: () => ({ data: mockTask, isLoading: false, error: null }),
  useUpdateTask: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteTask: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useTaskUpdates: () => ({ data: [], isLoading: false }),
  useCreateTaskUpdate: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/hooks/use-calendar", () => ({
  useCalendarEvents: () => ({ data: [], isLoading: false }),
}));

vi.mock("@/hooks/use-task-event-links", () => ({
  useTaskLinkedEvents: () => ({ data: [], isLoading: false }),
  useLinkTaskToEvent: () => ({ mutateAsync: vi.fn() }),
  useUnlinkTaskFromEvent: () => ({ mutateAsync: vi.fn() }),
}));

import TaskDetailPage from "@/app/(dashboard)/tasks/[id]/page";

describe("TaskDetailPage", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it("renders without crashing", () => {
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <TaskDetailPage />
      </QueryClientProvider>
    );
    expect(screen.getByText("Test Task")).toBeInTheDocument();
    expect(screen.getByText("TASK-1")).toBeInTheDocument();
  });
});
