import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { HeroCells } from "../hero-cells";

// Hoisted mock state — mutated per test, re-read by mocked hooks.
const { mockTasks, mockJobs, mockTodayEvents, mockWeekEvents } = vi.hoisted(
  () => ({
    mockTasks: { data: [] as unknown[] },
    mockJobs: { data: [] as unknown[] },
    mockTodayEvents: { data: [] as unknown[] },
    mockWeekEvents: { data: [] as unknown[] },
  }),
);

vi.mock("@/hooks/use-tasks", () => ({
  useTasks: () => ({ data: mockTasks.data }),
}));
vi.mock("@/hooks/use-jobs", () => ({
  useJobs: () => ({ data: mockJobs.data }),
}));
vi.mock("@/hooks/use-calendar", () => ({
  useCalendarEvents: ({ start }: { start?: string }) => {
    // The Hero fetches `todayBounds` first, then `thisWeekBounds`. The
    // today call's start matches today's 00:00; any other start is the
    // week call. Distinguish by presence of 'T00:00' plus a non-Monday
    // offset is fiddly — simpler: first call = today, second = week,
    // tracked via call order.
    calls.push(start ?? "");
    return {
      data: calls.length === 1 ? mockTodayEvents.data : mockWeekEvents.data,
    };
  },
}));

let calls: string[] = [];

beforeEach(() => {
  mockTasks.data = [];
  mockJobs.data = [];
  mockTodayEvents.data = [];
  mockWeekEvents.data = [];
  calls = [];
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
});
