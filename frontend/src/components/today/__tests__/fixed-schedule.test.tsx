import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { FixedSchedule } from "../fixed-schedule";

const { mockCtx } = vi.hoisted(() => ({
  mockCtx: {
    context: null as unknown,
    isLoading: false,
    error: null as unknown,
  },
}));

vi.mock("@/hooks/use-planner-context", () => ({
  usePlannerContext: () => mockCtx,
}));

beforeEach(() => {
  mockCtx.context = null;
  mockCtx.isLoading = false;
  mockCtx.error = null;
});

describe("FixedSchedule", () => {
  it("renders nothing when no calendar events", () => {
    mockCtx.context = { calendar_events: [], due_reminders: [] };
    const { container } = render(<FixedSchedule />);
    expect(container.firstChild).toBeNull();
  });

  it("renders calendar events sorted by start", () => {
    mockCtx.context = {
      calendar_events: [
        {
          id: "b",
          title: "Standup",
          start: "2026-04-20T10:00:00Z",
          end: "2026-04-20T10:30:00Z",
        },
        {
          id: "a",
          title: "Interview",
          start: "2026-04-20T14:00:00Z",
          end: "2026-04-20T15:00:00Z",
        },
      ],
      due_reminders: [],
    };
    render(<FixedSchedule />);
    const rows = screen.getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("Standup");
    expect(rows[1]).toHaveTextContent("Interview");
  });

  it("does NOT render reminders (only calendar events)", () => {
    mockCtx.context = {
      calendar_events: [
        {
          id: "a",
          title: "Interview",
          start: "2026-04-20T14:00:00Z",
          end: "2026-04-20T15:00:00Z",
        },
      ],
      due_reminders: [
        {
          id: 99,
          title: "Buy tickets",
          remind_at: "2026-04-20T10:30:00Z",
          action_date: null,
          is_urgent: true,
        },
      ],
    };
    render(<FixedSchedule />);
    expect(screen.queryByText(/Buy tickets/)).toBeNull();
  });
});
