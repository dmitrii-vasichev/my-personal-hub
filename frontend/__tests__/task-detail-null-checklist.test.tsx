import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "1" }),
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    user: { id: 1, role: "admin", display_name: "Test", email: "t@t.com" },
    isLoading: false,
  }),
}));

vi.mock("@/hooks/use-calendar", () => ({
  useCalendarEvents: () => ({ data: [], isLoading: false }),
}));

vi.mock("@/hooks/use-task-event-links", () => ({
  useTaskLinkedEvents: () => ({ data: [], isLoading: false }),
  useLinkTaskToEvent: () => ({ mutateAsync: vi.fn() }),
  useUnlinkTaskFromEvent: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("@/hooks/use-note-links", () => ({
  useTaskLinkedNotes: () => ({ data: [], isLoading: false }),
  useLinkNoteToTask: () => ({ mutate: vi.fn(), isPending: false }),
  useUnlinkNoteFromTask: () => ({ mutate: vi.fn() }),
}));

vi.mock("@/hooks/use-notes", () => ({
  useNotes: () => ({ data: [] }),
}));

function makeTask(overrides = {}) {
  return {
    id: 1,
    user_id: 1,
    created_by_id: 1,
    assignee_id: null,
    title: "Test Task",
    description: null,
    status: "new",
    priority: "medium",
    checklist: [],
    source: "web",
    visibility: "family",
    deadline: null,
    reminder_at: null,
    completed_at: null,
    created_at: "2026-03-10T12:00:00Z",
    updated_at: "2026-03-10T12:00:00Z",
    owner_name: null,
    assignee: null,
    ...overrides,
  };
}

let mockTaskData: ReturnType<typeof makeTask> | null = null;

vi.mock("@/hooks/use-tasks", () => ({
  useTask: () => ({ data: mockTaskData, isLoading: false, error: null }),
  useUpdateTask: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteTask: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useTaskUpdates: () => ({ data: [], isLoading: false }),
  useCreateTaskUpdate: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

import TaskDetailPage from "@/app/(dashboard)/tasks/[id]/page";

describe("TaskDetailPage — null safety", () => {
  let qc: QueryClient;

  beforeEach(() => {
    qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it("renders without crashing when checklist is null", () => {
    mockTaskData = makeTask({ checklist: null });
    expect(() =>
      render(
        <QueryClientProvider client={qc}>
          <TaskDetailPage />
        </QueryClientProvider>
      )
    ).not.toThrow();
    expect(screen.getByText("Test Task")).toBeInTheDocument();
  });

  it("renders without crashing when checklist is an empty array", () => {
    mockTaskData = makeTask({ checklist: [] });
    render(
      <QueryClientProvider client={qc}>
        <TaskDetailPage />
      </QueryClientProvider>
    );
    expect(screen.getByText("Test Task")).toBeInTheDocument();
    expect(screen.getByText("Checklist")).toBeInTheDocument();
  });

  it("renders checklist counter when items exist", () => {
    mockTaskData = makeTask({
      checklist: [
        { id: "1", text: "Step 1", completed: false },
        { id: "2", text: "Step 2", completed: true },
      ],
    });
    render(
      <QueryClientProvider client={qc}>
        <TaskDetailPage />
      </QueryClientProvider>
    );
    // Counter shows done/total
    expect(screen.getByText("1/2")).toBeInTheDocument();
    // Checklist section is present
    expect(screen.getByText("Checklist")).toBeInTheDocument();
  });
});
