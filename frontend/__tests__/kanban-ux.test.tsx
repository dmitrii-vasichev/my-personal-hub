import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { Task, KanbanBoard as KanbanBoardType, TaskStatus } from "@/types/task";
import {
  PRIORITY_BORDER_COLORS,
  DEFAULT_HIDDEN_COLUMNS,
  TASK_STATUS_ORDER,
} from "@/types/task";

// Mock dnd-kit
vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DragOverlay: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PointerSensor: class {},
  useSensor: () => ({}),
  useSensors: () => [],
  useDroppable: () => ({ setNodeRef: () => {}, isOver: false }),
  useDraggable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: () => {},
    transform: null,
  }),
}));

vi.mock("@dnd-kit/utilities", () => ({
  CSS: { Translate: { toString: () => "" } },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 1,
    user_id: 1,
    created_by_id: 1,
    assignee_id: null,
    title: "Test task",
    description: null,
    status: "new" as TaskStatus,
    priority: "medium",
    checklist: [],
    source: "web",
    visibility: "family",
    deadline: null,
    reminder_at: null,
    completed_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeBoard(overrides: Partial<KanbanBoardType> = {}): KanbanBoardType {
  return {
    new: [],
    in_progress: [],
    review: [],
    done: [],
    cancelled: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. Priority border colors
// ---------------------------------------------------------------------------

describe("TaskCard — priority border", () => {
  it("renders border-left for each priority", async () => {
    const { TaskCard } = await import("@/components/tasks/task-card");

    for (const priority of ["urgent", "high", "medium", "low"] as const) {
      const { container, unmount } = render(
        <TaskCard task={makeTask({ id: Number(priority.charCodeAt(0)), priority })} />
      );
      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain("border-l-[3px]");
      expect(card.className).toContain(PRIORITY_BORDER_COLORS[priority]);
      unmount();
    }
  });

  it("does NOT render priority text label", async () => {
    const { TaskCard } = await import("@/components/tasks/task-card");
    render(<TaskCard task={makeTask({ priority: "high" })} />);
    expect(screen.queryByText("high")).not.toBeInTheDocument();
    expect(screen.queryByText("High")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 2. KanbanColumn — Done collapse
// ---------------------------------------------------------------------------

describe("KanbanColumn — Done collapse", () => {
  it("shows only 10 tasks in done column when >10", async () => {
    const { KanbanColumn } = await import("@/components/tasks/kanban-column");
    const tasks = Array.from({ length: 15 }, (_, i) =>
      makeTask({ id: i + 1, status: "done", title: `Done task ${i + 1}` })
    );

    render(<KanbanColumn status="done" tasks={tasks} activeTaskId={null} />);

    // Should see "Show all (15)" button
    expect(screen.getByText("Show all (15)")).toBeInTheDocument();
    // Should only show 10 tasks
    expect(screen.queryByText("Done task 11")).not.toBeInTheDocument();
    expect(screen.getByText("Done task 10")).toBeInTheDocument();
  });

  it("expands all tasks when Show all is clicked", async () => {
    const { KanbanColumn } = await import("@/components/tasks/kanban-column");
    const tasks = Array.from({ length: 12 }, (_, i) =>
      makeTask({ id: i + 1, status: "done", title: `Done task ${i + 1}` })
    );

    render(<KanbanColumn status="done" tasks={tasks} activeTaskId={null} />);
    fireEvent.click(screen.getByText("Show all (12)"));

    expect(screen.getByText("Done task 12")).toBeInTheDocument();
    expect(screen.getByText("Show less")).toBeInTheDocument();
  });

  it("does NOT collapse non-done columns", async () => {
    const { KanbanColumn } = await import("@/components/tasks/kanban-column");
    const tasks = Array.from({ length: 15 }, (_, i) =>
      makeTask({ id: i + 1, status: "new", title: `New task ${i + 1}` })
    );

    render(<KanbanColumn status="new" tasks={tasks} activeTaskId={null} />);
    expect(screen.queryByText(/Show all/)).not.toBeInTheDocument();
    expect(screen.getByText("New task 15")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 3. KanbanBoard — hidden columns
// ---------------------------------------------------------------------------

describe("KanbanBoard — column visibility", () => {
  it("hides columns listed in hiddenColumns", async () => {
    const { KanbanBoard } = await import("@/components/tasks/kanban-board");
    const board = makeBoard({
      new: [makeTask({ id: 1, title: "Task A" })],
      review: [makeTask({ id: 2, title: "Task B", status: "review" })],
    });

    render(
      <KanbanBoard
        board={board}
        onStatusChange={() => {}}
        hiddenColumns={["review", "cancelled"]}
      />
    );

    expect(screen.getByText("Task A")).toBeInTheDocument();
    expect(screen.queryByText("Task B")).not.toBeInTheDocument();
  });

  it("shows all columns when hiddenColumns is empty", async () => {
    const { KanbanBoard } = await import("@/components/tasks/kanban-board");
    const board = makeBoard();

    const { container } = render(
      <KanbanBoard board={board} onStatusChange={() => {}} hiddenColumns={[]} />
    );

    // All 5 status headers should be present
    expect(screen.getByText("New")).toBeInTheDocument();
    expect(screen.getByText("In Progress")).toBeInTheDocument();
    expect(screen.getByText("Review")).toBeInTheDocument();
    expect(screen.getByText("Done")).toBeInTheDocument();
    expect(screen.getByText("Cancelled")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 4. DEFAULT_HIDDEN_COLUMNS
// ---------------------------------------------------------------------------

describe("DEFAULT_HIDDEN_COLUMNS", () => {
  it("hides review and cancelled by default", () => {
    expect(DEFAULT_HIDDEN_COLUMNS).toEqual(["review", "cancelled"]);
  });
});
