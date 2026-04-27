import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HeroPriority } from "../hero-priority";

const { mockTasks, mockEvents, updateTask } = vi.hoisted(() => ({
  mockTasks: { data: [] as unknown[] },
  mockEvents: { data: [] as unknown[] },
  updateTask: { mutate: vi.fn(), isPending: false },
}));

vi.mock("@/hooks/use-tasks", () => ({
  useTasks: () => ({ data: mockTasks.data }),
  useUpdateTask: () => updateTask,
}));

vi.mock("@/hooks/use-calendar", () => ({
  useCalendarEvents: () => ({ data: mockEvents.data }),
}));

function task(overrides: Record<string, unknown> = {}) {
  return {
    id: 42,
    title: "Write interview draft",
    description: "Draft the follow-up note",
    status: "new",
    priority: "urgent",
    deadline: new Date().toISOString(),
    linked_document_id: null,
    linked_document: null,
    ...overrides,
  };
}

beforeEach(() => {
  mockTasks.data = [];
  mockEvents.data = [];
  updateTask.mutate.mockReset();
});

describe("HeroPriority draft link", () => {
  it("renders Jump to draft for task targets with a primary linked document", () => {
    mockTasks.data = [
      task({
        linked_document_id: 7,
        linked_document: {
          id: 7,
          title: "Draft.md",
          folder_path: "Career",
          google_file_id: "drive_file_7",
          file_id: "drive_file_7",
        },
      }),
    ];

    render(<HeroPriority />);

    const link = screen.getByRole("link", { name: /jump to draft/i });
    expect(link).toHaveAttribute("href", "/notes?file=drive_file_7");
  });

  it("omits Jump to draft when the task has no primary linked document", () => {
    mockTasks.data = [task()];

    render(<HeroPriority />);

    expect(
      screen.queryByRole("link", { name: /jump to draft/i })
    ).not.toBeInTheDocument();
  });
});
