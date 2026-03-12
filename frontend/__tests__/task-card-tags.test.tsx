import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Task, TaskStatus } from "@/types/task";
import { TaskCard } from "@/components/tasks/task-card";

// Mock dnd-kit
vi.mock("@dnd-kit/sortable", () => ({
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
  CSS: { Transform: { toString: () => "" } },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

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
    tags: [],
    ...overrides,
  };
}

describe("TaskCard with tags", () => {
  it("renders without tags (no empty space)", () => {
    const task = makeTask();
    render(<TaskCard task={task} />);
    expect(screen.getByText("Test task")).toBeInTheDocument();
    expect(screen.queryByText(/\+/)).not.toBeInTheDocument();
  });

  it("renders tag pills when task has tags", () => {
    const task = makeTask({
      tags: [
        { id: 1, name: "Work", color: "#4f8ef7" },
        { id: 2, name: "Personal", color: "#34d399" },
      ],
    });
    render(<TaskCard task={task} />);
    expect(screen.getByText("Work")).toBeInTheDocument();
    expect(screen.getByText("Personal")).toBeInTheDocument();
  });

  it("shows overflow indicator for 3+ tags", () => {
    const task = makeTask({
      tags: [
        { id: 1, name: "Work", color: "#4f8ef7" },
        { id: 2, name: "Personal", color: "#34d399" },
        { id: 3, name: "Home", color: "#f87171" },
      ],
    });
    render(<TaskCard task={task} />);
    expect(screen.getByText("Work")).toBeInTheDocument();
    expect(screen.getByText("Personal")).toBeInTheDocument();
    expect(screen.queryByText("Home")).not.toBeInTheDocument();
    expect(screen.getByText("+1")).toBeInTheDocument();
  });
});
