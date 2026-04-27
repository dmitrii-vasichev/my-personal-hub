import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Task, TaskStatus } from "@/types/task";
import {
  TASK_STATUS_ORDER,
  TASK_STATUS_LABELS,
  DEFAULT_HIDDEN_COLUMNS,
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
    Transform: { toString: () => "" },
    Transition: { toString: () => "" },
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/tasks",
}));

import { KanbanColumn } from "@/components/tasks/kanban-column";

// ── Type & constant tests ───────────────────────────────────────────

describe("Backlog status constants", () => {
  it("TASK_STATUS_ORDER starts with backlog", () => {
    expect(TASK_STATUS_ORDER[0]).toBe("backlog");
  });

  it("TASK_STATUS_ORDER has 6 statuses", () => {
    expect(TASK_STATUS_ORDER).toHaveLength(6);
  });

  it("TASK_STATUS_LABELS includes backlog", () => {
    expect(TASK_STATUS_LABELS.backlog).toBe("Backlog");
  });

  it("backlog is not in DEFAULT_HIDDEN_COLUMNS", () => {
    expect(DEFAULT_HIDDEN_COLUMNS).not.toContain("backlog");
  });

  it("DEFAULT_HIDDEN_COLUMNS contains review and cancelled", () => {
    expect(DEFAULT_HIDDEN_COLUMNS).toContain("review");
    expect(DEFAULT_HIDDEN_COLUMNS).toContain("cancelled");
  });
});

// ── KanbanColumn renders with backlog ───────────────────────────────

describe("KanbanColumn with backlog status", () => {
  it("renders backlog column header", () => {
    render(
      <KanbanColumn
        status="backlog"
        tasks={[]}
        activeTaskId={null}
      />
    );
    expect(screen.getByText("Backlog")).toBeInTheDocument();
  });

  it("renders backlog column with tasks", () => {
    const tasks: Task[] = [
      {
        id: 1,
        user_id: 1,
        created_by_id: 1,
        assignee_id: null,
        title: "Some idea",
        description: null,
        status: "backlog" as TaskStatus,
        priority: "medium",
        checklist: [],
        source: "web",
        visibility: "family",
        deadline: null,
        reminder_at: null,
        completed_at: null,
        kanban_order: 0,
        created_at: "2026-03-11T00:00:00Z",
        updated_at: "2026-03-11T00:00:00Z",
        tags: [],
      },
    ];

    render(
      <KanbanColumn
        status="backlog"
        tasks={tasks}
        activeTaskId={null}
      />
    );
    expect(screen.getByText("Some idea")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument(); // task count
  });
});
