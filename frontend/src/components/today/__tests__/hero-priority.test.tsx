import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HeroPriority } from "../hero-priority";

const { mockActions, mockEvents, updateAction } = vi.hoisted(() => ({
  mockActions: { data: [] as unknown[] },
  mockEvents: { data: [] as unknown[] },
  updateAction: { mutate: vi.fn(), isPending: false },
}));

vi.mock("@/hooks/use-actions", () => ({
  useActions: () => ({ data: mockActions.data }),
  useUpdateAction: () => updateAction,
}));

vi.mock("@/hooks/use-calendar", () => ({
  useCalendarEvents: () => ({ data: mockEvents.data }),
}));

function action(overrides: Record<string, unknown> = {}) {
  const now = new Date().toISOString();
  return {
    id: 42,
    title: "Write interview draft",
    details: "Draft the follow-up note",
    status: "pending",
    is_urgent: true,
    action_date: now.slice(0, 10),
    remind_at: now,
    ...overrides,
  };
}

beforeEach(() => {
  mockActions.data = [];
  mockEvents.data = [];
  updateAction.mutate.mockReset();
});

describe("HeroPriority actions", () => {
  it("renders the top action and opens Actions", () => {
    mockActions.data = [action()];

    render(<HeroPriority />);

    expect(screen.getByRole("heading", { name: /write interview draft/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open action/i })).toHaveAttribute("href", "/actions");
  });

  it("does not render task draft controls", () => {
    mockActions.data = [action()];

    render(<HeroPriority />);

    expect(screen.queryByRole("link", { name: /jump to draft/i })).not.toBeInTheDocument();
  });
});
