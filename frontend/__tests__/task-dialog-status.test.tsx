import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TASK_STATUS_ORDER } from "@/types/task";

// Mock useCreateTask — file-scoped, only affects this test file
vi.mock("@/hooks/use-tasks", () => ({
  useCreateTask: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("@/hooks/use-tags", () => ({
  useTags: () => ({ data: [] }),
  useCreateTag: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

import { TaskDialog } from "@/components/tasks/task-dialog";

describe("TaskDialog — initialStatus", () => {
  it("defaults status to 'new' when no initialStatus", () => {
    render(<TaskDialog onClose={() => {}} />);

    const select = screen.getByDisplayValue("New");
    expect(select).toBeInTheDocument();
  });

  it("defaults status to initialStatus when provided", () => {
    render(<TaskDialog onClose={() => {}} initialStatus="done" />);

    const select = screen.getByDisplayValue("Done");
    expect(select).toBeInTheDocument();
  });

  it("shows all statuses in dropdown", () => {
    render(<TaskDialog onClose={() => {}} initialStatus="backlog" />);

    const options = screen.getAllByRole("option");
    const values = options.map((o) => (o as HTMLOptionElement).value);
    for (const status of TASK_STATUS_ORDER) {
      expect(values).toContain(status);
    }
  });
});
