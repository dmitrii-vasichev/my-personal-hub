import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { HeroCells } from "../hero-cells";

// Hoisted mock state — mutated per test, re-read by mocked hooks.
const { mockActions, mockJobs, mockWeekEvents, mockPulseUnread } = vi.hoisted(
  () => ({
    mockActions: { data: [] as unknown[] },
    mockJobs: { data: [] as unknown[] },
    mockWeekEvents: { data: [] as unknown[] },
    mockPulseUnread: { data: { unread_count: 0 } },
  }),
);

vi.mock("@/hooks/use-actions", () => ({
  useActions: () => ({ data: mockActions.data }),
}));
vi.mock("@/hooks/use-jobs", () => ({
  useJobs: () => ({ data: mockJobs.data }),
}));
vi.mock("@/hooks/use-calendar", () => ({
  useCalendarEvents: () => ({ data: mockWeekEvents.data }),
}));
vi.mock("@/hooks/use-pulse-digest-items", () => ({
  usePulseUnreadCount: () => ({ data: mockPulseUnread.data }),
}));

beforeEach(() => {
  mockActions.data = [];
  mockJobs.data = [];
  mockWeekEvents.data = [];
  mockPulseUnread.data = { unread_count: 0 };
});

describe("HeroCells — Interviews this week", () => {
  it("counts week events with job_id set, ignoring null ones", () => {
    mockWeekEvents.data = [
      { id: 1, job_id: 10, title: "Interview with Acme" },
      { id: 2, job_id: null, title: "Team standup" },
      { id: 3, job_id: 11, title: "Globex onsite" },
    ];
    render(<HeroCells />);
    const cell = screen.getByText("Interviews this week").closest("div");
    expect(cell).not.toBeNull();
    // Number is rendered as a sibling of the label div within the same cell.
    expect(screen.getByText("Interviews this week")).toBeInTheDocument();
    // Pull the numeric value by walking up to the cell root and looking
    // for the big number.
    const parent = cell?.parentElement;
    expect(parent?.textContent).toContain("2");
  });

  it("shows 0 when the week has no linked events", () => {
    mockWeekEvents.data = [
      { id: 1, job_id: null, title: "Generic meeting" },
    ];
    render(<HeroCells />);
    expect(screen.getByText("Interviews this week")).toBeInTheDocument();
    const parent = screen
      .getByText("Interviews this week")
      .closest("div")?.parentElement;
    expect(parent?.textContent).toContain("0");
  });

  it("renders Pulse unread from unread count endpoint", () => {
    mockPulseUnread.data = { unread_count: 7 };

    render(<HeroCells />);

    expect(screen.getByText("Pulse unread")).toBeInTheDocument();
    const parent = screen
      .getByText("Pulse unread")
      .closest("div")?.parentElement;
    expect(parent?.textContent).toContain("7");
  });
});
