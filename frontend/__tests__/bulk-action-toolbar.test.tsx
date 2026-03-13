import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BulkActionToolbar } from "@/components/tasks/bulk-action-toolbar";
import type { KanbanBoard } from "@/types/task";

const mockTags = [
  { id: 1, name: "Work", color: "#4f8ef7", task_count: 5, created_at: "2026-01-01" },
  { id: 2, name: "Personal", color: "#34d399", task_count: 3, created_at: "2026-01-01" },
];

const mockBulkTag = vi.fn().mockResolvedValue({ affected_tasks: 2 });

vi.mock("@/hooks/use-tags", () => ({
  useTags: () => ({ data: mockTags }),
  useBulkTag: () => ({
    mutateAsync: mockBulkTag,
    isPending: false,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const mockBoard: KanbanBoard = {
  backlog: [],
  new: [
    {
      id: 10,
      title: "Task A",
      description: null,
      status: "new",
      priority: "medium",
      visibility: "family",
      tags: [{ id: 1, name: "Work", color: "#4f8ef7" }],
      kanban_order: 1,
      deadline: null,
      reminder_at: null,
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
      owner_id: 1,
      owner_name: "Test",
      assignee_id: null,
      assignee: null,
      checklist: [],
    },
    {
      id: 11,
      title: "Task B",
      description: null,
      status: "new",
      priority: "low",
      visibility: "family",
      tags: [{ id: 2, name: "Personal", color: "#34d399" }],
      kanban_order: 2,
      deadline: null,
      reminder_at: null,
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
      owner_id: 1,
      owner_name: "Test",
      assignee_id: null,
      assignee: null,
      checklist: [],
    },
  ],
  in_progress: [],
  review: [],
  done: [],
  cancelled: [],
};

describe("BulkActionToolbar", () => {
  let onClearSelection: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    onClearSelection = vi.fn();
  });

  it("shows correct task count", () => {
    render(
      <Wrapper>
        <BulkActionToolbar
          selectedTaskIds={new Set([10, 11])}
          board={mockBoard}
          onClearSelection={onClearSelection}
        />
      </Wrapper>
    );
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("tasks selected")).toBeInTheDocument();
  });

  it("shows singular for 1 task", () => {
    render(
      <Wrapper>
        <BulkActionToolbar
          selectedTaskIds={new Set([10])}
          board={mockBoard}
          onClearSelection={onClearSelection}
        />
      </Wrapper>
    );
    expect(screen.getByText("task selected")).toBeInTheDocument();
  });

  it("clears selection on Cancel click", () => {
    render(
      <Wrapper>
        <BulkActionToolbar
          selectedTaskIds={new Set([10, 11])}
          board={mockBoard}
          onClearSelection={onClearSelection}
        />
      </Wrapper>
    );
    fireEvent.click(screen.getByText("Cancel"));
    expect(onClearSelection).toHaveBeenCalled();
  });

  it("shows Add tag dropdown with all tags", () => {
    render(
      <Wrapper>
        <BulkActionToolbar
          selectedTaskIds={new Set([10])}
          board={mockBoard}
          onClearSelection={onClearSelection}
        />
      </Wrapper>
    );
    fireEvent.click(screen.getByText("Add tag"));
    expect(screen.getByText("Work")).toBeInTheDocument();
    expect(screen.getByText("Personal")).toBeInTheDocument();
  });

  it("shows Remove tag dropdown with only tags on selected tasks", () => {
    render(
      <Wrapper>
        <BulkActionToolbar
          selectedTaskIds={new Set([10])}
          board={mockBoard}
          onClearSelection={onClearSelection}
        />
      </Wrapper>
    );
    fireEvent.click(screen.getByText("Remove tag"));
    // Task 10 only has "Work" tag
    expect(screen.getByText("Work")).toBeInTheDocument();
  });

  it("calls bulkTag API on Add tag selection", async () => {
    render(
      <Wrapper>
        <BulkActionToolbar
          selectedTaskIds={new Set([10, 11])}
          board={mockBoard}
          onClearSelection={onClearSelection}
        />
      </Wrapper>
    );
    fireEvent.click(screen.getByText("Add tag"));
    // Click "Personal" in the dropdown
    const personalButtons = screen.getAllByText("Personal");
    fireEvent.click(personalButtons[personalButtons.length - 1]);

    await waitFor(() => {
      expect(mockBulkTag).toHaveBeenCalledWith({
        task_ids: [10, 11],
        add_tag_ids: [2],
      });
    });
    expect(onClearSelection).toHaveBeenCalled();
  });
});
