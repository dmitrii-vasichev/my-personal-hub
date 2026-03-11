import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { Task, KanbanBoard as KanbanBoardType, TaskStatus } from "@/types/task";

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

vi.mock("@dnd-kit/sortable", () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  verticalListSortingStrategy: {},
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: () => {},
    transform: null,
    transition: null,
    isDragging: false,
  }),
}));

vi.mock("@dnd-kit/utilities", () => ({
  CSS: {
    Translate: { toString: () => "" },
    Transform: { toString: () => "" },
  },
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
    kanban_order: 0,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeBoard(overrides: Partial<KanbanBoardType> = {}): KanbanBoardType {
  return {
    backlog: [],
    new: [],
    in_progress: [],
    review: [],
    done: [],
    cancelled: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. KanbanColumn — "+" button
// ---------------------------------------------------------------------------

describe("KanbanColumn — add task button", () => {
  it("renders + button when onAddTask is provided", async () => {
    const { KanbanColumn } = await import("@/components/tasks/kanban-column");
    const onAddTask = vi.fn();

    render(
      <KanbanColumn
        status="backlog"
        tasks={[]}
        activeTaskId={null}
        onAddTask={onAddTask}
      />
    );

    const btn = screen.getByTitle("Add task to Backlog");
    expect(btn).toBeInTheDocument();
  });

  it("does not render + button when onAddTask is not provided", async () => {
    const { KanbanColumn } = await import("@/components/tasks/kanban-column");

    render(
      <KanbanColumn status="new" tasks={[]} activeTaskId={null} />
    );

    expect(screen.queryByTitle(/Add task/)).not.toBeInTheDocument();
  });

  it("calls onAddTask when + button is clicked", async () => {
    const { KanbanColumn } = await import("@/components/tasks/kanban-column");
    const onAddTask = vi.fn();

    render(
      <KanbanColumn
        status="in_progress"
        tasks={[makeTask({ id: 1, status: "in_progress" })]}
        activeTaskId={null}
        onAddTask={onAddTask}
      />
    );

    fireEvent.click(screen.getByTitle("Add task to In Progress"));
    expect(onAddTask).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// 2. KanbanBoard — onAddTask passed to columns
// ---------------------------------------------------------------------------

describe("KanbanBoard — onAddTask", () => {
  it("renders + buttons in all visible columns when onAddTask is provided", async () => {
    const { KanbanBoard } = await import("@/components/tasks/kanban-board");
    const onAddTask = vi.fn();
    const board = makeBoard();

    render(
      <KanbanBoard
        board={board}
        onStatusChange={() => {}}
        onReorder={() => {}}
        hiddenColumns={["review", "cancelled"]}
        onAddTask={onAddTask}
      />
    );

    // Visible columns: backlog, new, in_progress, done
    expect(screen.getByTitle("Add task to Backlog")).toBeInTheDocument();
    expect(screen.getByTitle("Add task to New")).toBeInTheDocument();
    expect(screen.getByTitle("Add task to In Progress")).toBeInTheDocument();
    expect(screen.getByTitle("Add task to Done")).toBeInTheDocument();

    // Hidden columns should not have buttons
    expect(screen.queryByTitle("Add task to Review")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Add task to Cancelled")).not.toBeInTheDocument();
  });

  it("calls onAddTask with correct status when column + is clicked", async () => {
    const { KanbanBoard } = await import("@/components/tasks/kanban-board");
    const onAddTask = vi.fn();
    const board = makeBoard();

    render(
      <KanbanBoard
        board={board}
        onStatusChange={() => {}}
        onReorder={() => {}}
        hiddenColumns={[]}
        onAddTask={onAddTask}
      />
    );

    fireEvent.click(screen.getByTitle("Add task to Backlog"));
    expect(onAddTask).toHaveBeenCalledWith("backlog");

    fireEvent.click(screen.getByTitle("Add task to Done"));
    expect(onAddTask).toHaveBeenCalledWith("done");
  });
});

